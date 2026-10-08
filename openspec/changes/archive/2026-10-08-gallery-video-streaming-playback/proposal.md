# 提案：相册视频在线流式播放

## Why

当前双端相册中的视频条目无法在线播放：查看器仅展示截帧缩略图并提示"视频不支持在线播放"，用户必须下载原图后才能在本地播放（`client/lib/features/gallery/presentation/gallery_viewer_page.dart` 的 `_VideoStillView`）。这是视频体验的核心缺口，而技术基础已具备——视频原样存储在 OSS，客户端持有受限 AccessKey 直连 OSS，且两端 OSS SDK 均支持生成 GetObject 预签名 URL（macOS 端已在下载链路使用 presign）。引入流式播放可让用户点开即看，无需等待整文件下载。

## What Changes

- 相册查看器中视频条目由"截帧图 + 下载提示"改为内嵌视频播放器，直接通过 OSS 预签名 URL 流式播放（依赖 HTTP Range 请求按需拉取，无需下载完整文件）
- 播放器提供基础控制：播放/暂停、进度条拖动、时长显示；播放器就绪前展示截帧缩略图作为封面
- 保留"下载原图"操作（用于离线保存原画质），下载完成逻辑不变
- 退出查看器或切换条目时停止播放并释放播放器资源
- 明确不做分辨率切换：源文件单一分辨率，播放端无法降低源码率；低码率转码档（如 720p 预览）留待后续按需提案
- 预签名 URL 仅在内存中短期使用，不落盘、不写入日志

## Capabilities

### New Capabilities

- `video-streaming-playback`: 相册视频通过 OSS 预签名 URL 流式在线播放的能力，包括播放器交互、封面占位、资源释放、下载共存与播放失败兜底

### Modified Capabilities

- `photo-viewer`: 删除"视频条目不支持在线播放"的既有需求，替换为视频条目进入内嵌播放器在线播放；原图缓存角标、连续浏览边界等行为保持不变

## Impact

- 客户端（`client/` 子仓库）：
  - 新增播放器依赖（选型见 design.md，倾向 `media_kit`）
  - `gallery_viewer_page.dart`：`_VideoStillView` 替换为视频播放视图
  - `gallery_controller.dart`：新增生成视频预签名 URL 的入口
  - `packages/private_domain_oss`：Android 端需补 presign 能力（macOS 已有）
- 服务端：无改动（FC 不参与文件流量，预签名由客户端 SDK 生成）
- 主仓库文档：归档后需同步 `openspec/specs/photo-viewer/`、新增 `video-streaming-playback/`；`docs/技术文档.md` 若涉及传输描述需同步
- 已知风险：MP4 moov atom 位于文件尾时起播需先请求文件尾部，启动可能变慢；HEVC 等编码在部分旧设备可能无法解码，需播放失败兜底
