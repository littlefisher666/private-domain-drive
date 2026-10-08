# 设计：相册视频在线流式播放

## Context

- 视频原样存储在 OSS（无转码），缩略图为客户端本地截帧后独立上传到 `.gallery/thumbs/` 前缀。
- 当前查看器中视频条目走 `_VideoStillView`（`client/lib/features/gallery/presentation/gallery_viewer_page.dart`），仅展示截帧 + 下载原图。
- 客户端持有受限 AccessKey 直连 OSS。macOS 原生插件已用 Swift OSS SDK `presign` 生成 GetObject 预签名 URL（下载链路）；Android 原生插件基于 oss-android-sdk，具备 `presignConstrainedURL` 能力但尚未暴露。
- OSS 支持 HTTP Range 请求，播放器可按需拉取字节区间，无需下载完整文件。
- 双端（Android + macOS）共用 Flutter 业务层，平台差异收敛在 `packages/private_domain_oss` 插件层。

## Goals / Non-Goals

**Goals:**

- 相册查看器中视频条目可直接在线播放，点开即播（不要求秒开，但起播等待应明显小于整文件下载）
- 双端一致的播放体验：基础控制（播放/暂停、进度、时长）、截帧封面、资源释放
- 保留下载原图能力，与播放互不干扰

**Non-Goals:**

- 分辨率/清晰度切换（源文件单一分辨率，播放端无法降低源码率；低码率转码档留待后续提案）
- 播放器高级功能：倍速、音轨/字幕选择、画中画、后台播放
- 服务端任何改动（FC 不参与）
- 文件库（workspace）中非相册视频的播放，本期仅覆盖相册查看器

## Decisions

### D1：播放器选 `media_kit`（libmpv）

- **选择**：`media_kit` + `media_kit_video`。
- **理由**：双端同一 libmpv 内核，格式/编码兼容性（H.264/HEVC、moov 在尾部的 MP4）由 mpv 统一处理，避免 Android（ExoPlayer）与 macOS（AVPlayer）行为分叉；HTTP Range 拉流成熟。
- **备选**：
  - `video_player`：官方维护，但 macOS 桌面端体验一般，HEVC 与非 faststart MP4 的兼容性依赖各平台内核，双端行为不一致的风险高。
  - `fvp`（libmpv 封装）：与 media_kit 同内核，社区活跃度低于 media_kit，不选。
- **代价**：引入原生 libmpv 二进制，安装包体积增加（Android 约 +20~30MB，macOS 视架构）。个人网盘场景可接受。

### D2：播放源用客户端生成的 OSS 预签名 URL，有效期短且不落盘

- **选择**：在 `private_domain_oss` Dart 接口新增 `presignGetObjectUrl(objectKey, {expires})`，内部转发到各平台原生 SDK presign；Android 端补实现（`OSSPlainTextAKSKCredentialProvider` + `presignConstrainedURL`），macOS 端复用现有 presign 逻辑。
- **理由**：与既有"客户端持 AK 直连 OSS"架构一致，FC 零参与；presign 是纯本地计算（HMAC 签名），无网络开销。
- **有效期**：URL 有效期取 1 小时（播放器加载即用，播完即弃）；内存中持有，不写日志、不落盘。
- **备选**：Dart 层自行实现 OSS V4 签名（不依赖原生 SDK）——多一套签名实现且与插件层职责重叠，不选。

### D3：播放视图替换 `_VideoStillView`，封面复用截帧缩略图

- **选择**：查看器视频分支渲染 `VideoWidget`（media_kit），初始化前以其截帧缩略图为封面；`Player` 生命周期与条目绑定，切换条目或退出查看器时 `dispose`。
- **理由**：截帧缩略图已存在于索引，天然是封面素材；条目级 dispose 避免后台继续拉流消耗流量。

### D4：不自动播放，用户点按后起播

- **选择**：进入视频条目默认展示封面 + 播放按钮，点按后才开始加载与播放。
- **理由**：延续"不自动播放"的既有口径，避免连续浏览时误触发大量流量；用户明确意图后再消耗带宽。

### D5：播放失败兜底回退到现有下载路径

- **选择**：播放器报错（解码失败、URL 过期、网络错误重试耗尽）时展示错误提示 + 下载原图入口，即回退到当前 `_VideoStillView` 的能力面。
- **理由**：HEVC 在旧 Android 设备、异常编码文件等场景无法根除，兜底保证功能不倒退。

## Risks / Trade-offs

- [moov atom 在文件尾部的 MP4 起播慢] → mpv 会先请求文件尾部定位索引，通常只多一次 Range 往返；若体验不可接受，后续可在上传时用 `video/snapshot` 或 ffmpeg faststart 处理（二期）。
- [安装包体积增加（libmpv）] → 个人网盘可接受；media_kit 官方支持按平台裁剪，必要时评估。
- [预签名 URL 泄露风险] → URL 仅内存持有、1 小时过期、不写入日志与持久化；密钥本身仍只在平台安全存储中。
- [流量消耗] → 不自动播放 + 条目级 dispose 收敛流量；无 Wi-Fi 提醒（如"仅 Wi-Fi 播放"开关）不在本期范围。
- [Android 端 presign 首次暴露] → 需要为 oss-android-sdk 的 `presignConstrainedURL` 写插件通道实现并双端验证；实现简单（纯本地签名）。

## Migration Plan

纯客户端变更，无数据迁移：

1. `private_domain_oss` 增加 presign 接口（先 macOS 复用、再补 Android 实现）
2. 引入 media_kit 依赖并完成双端初始化
3. 查看器替换视频视图，灰度验证双端播放
4. 回滚方式：还原查看器视频分支为 `_VideoStillView` 即可，presign 接口保留无副作用

## Open Questions

- 无：播放器选型、URL 有效期、是否自动播放均已在设计中定案，实现中若发现 media_kit 在 macOS 上的明显缺陷，回退备选是 `fvp`（同为 libmpv 内核，API 兼容迁移成本低）。
