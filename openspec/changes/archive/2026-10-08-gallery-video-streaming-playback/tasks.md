# 任务：相册视频在线流式播放

以下任务均在 `client/` 子仓库完成（除标注主仓库外）。

## 1. OSS 插件补齐 presign 能力

- [x] 1.1 `packages/private_domain_oss` Dart 接口新增 `presignGetObjectUrl(objectKey, {Duration expires})`，URL 仅内存返回，接口文档注释注明不得落盘/打日志
- [x] 1.2 macOS 端 `PrivateDomainOssPlugin.swift` 复用现有 presign 逻辑实现该接口，有效期默认 1 小时
- [x] 1.3 Android 端 `PrivateDomainOssPlugin.kt` 用 oss-android-sdk `presignConstrainedURL` 实现该接口
- [x] 1.4 双端各写一个手动验证（生成 URL 后用 curl Range 请求验证可拉流、过期后失效）

## 2. 引入 media_kit 播放器

- [x] 2.1 `pubspec.yaml` 添加 `media_kit`、`media_kit_video` 及平台包依赖，完成 `flutter pub get`
- [x] 2.2 应用启动入口（main）完成 MediaKit 初始化，双端构建通过（`flutter build apk --debug` / `flutter build macos --debug`）

## 3. 查看器视频播放视图

- [x] 3.1 `gallery_controller.dart` 新增生成视频预签名 URL 的入口（按需生成、内存持有、失败可重新生成）
- [x] 3.2 `gallery_viewer_page.dart` 将 `_VideoStillView` 替换为内嵌播放视图：截帧缩略图封面 + 播放按钮，不自动播放
- [x] 3.3 实现播放控制：播放/暂停、进度条拖动、时长显示
- [x] 3.4 条目级生命周期管理：切换条目/退出查看器时停止播放并 dispose 播放器，验证不再产生流量
- [x] 3.5 播放失败兜底：展示失败提示 + 重新播放按钮 + 下载原图入口（复用现有下载逻辑，验证下载与播放互不阻塞、缓存角标行为不变）

## 4. 双端验证与文档

- [x] 4.1 Android 真机验证：点开即播、Range 流式（本地无完整副本）、暂停/拖动、退出停止、HEVC 异常文件兜底下载
- [x] 4.2 macOS 验证：同上用例
- [x] 4.3 主仓库：归档后同步 `openspec/specs/`（删除 photo-viewer 旧需求、新增 video-streaming-playback），按需更新 `docs/技术文档.md` 传输描述，并更新 submodule 指针
