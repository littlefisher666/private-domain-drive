# Proposal

## Why

Android 端分享导入的文件复制（`MainActivity.kt` 的 `copySharedFiles()`）在**主线程同步执行**：用户从相册分享大批量文件（上百张照片、视频）时，复制阶段会阻塞 UI 线程，表现为应用长时间无响应，极端情况下触发 ANR。同时复制期间没有任何进度反馈，用户只能面对无响应的应用等待整批复制完成。

## What Changes

- 原生端复制后台化：分享文件的 URI 拷贝从主线程移到后台单线程执行器，主线程不再阻塞。
- 事件协议升级：原生端按「批次开始 → 逐项推送 → 批次完成」的信封格式推送事件，每个文件复制完成即推送给 Flutter 侧，不再等整批复制完。
- 目录选择弹窗渐进展示：分享进入后目录选择弹窗立即弹出（登录就绪前提下），弹窗内展示导入进度（已导入 x/n）；批次复制完成前禁用「上传到此处」按钮，复制完成后启用。
- 防重入口径调整：分享防重入签名从「按待上传项 id 拼接」改为「按批次 id」，适配逐项到达的事件流。
- 健壮性修复：`pendingItems` 缓冲改为线程安全；修复后台化后「批次完成晚于 Dart 启动」的冷启动竞态（事件流已监听则实时推送并冲刷缓冲，未监听则缓冲完整批次由 `takePendingItems` 兜底）；单个文件复制失败时跳过并在批次完成事件中携带失败计数。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `share-import`：新增「分享文件后台异步复制与进度反馈」要求（复制不得阻塞主线程、逐项推送进度、批次完成后才允许确认上传）；修改「接收系统分享并弹出目录选择」要求的弹窗时机口径（弹窗可先于复制完成弹出，确认动作等待批次完成）。

## Impact

- `client/android/.../MainActivity.kt`：`receiveShareIntent`/`copySharedFiles` 后台化、事件信封协议、缓冲线程安全与冷启动竞态处理（本次改动主体）。
- `client/lib/features/share_import/infrastructure/android_share_import_bridge.dart`：事件解析适配信封协议，`takePendingItems` 返回完整批次。
- `client/lib/shared/state/app_controller.dart`：分享批次渐进接收（批次开始/逐项追加/批次完成）、批次 id 防重入。
- `client/lib/app/app.dart`：防重入签名改用批次 id；目录选择弹窗调用点适配。
- `client/lib/features/share_import/presentation/share_target_dialog.dart`：新增导入进度展示与确认按钮禁用逻辑。
- 服务端无改动；macOS 端无分享导入链路，不受影响。
- 与进行中的 `add-upload-persistence-resume` 提案的关系：该提案负责把分享导入文件从 `cacheDir` 迁移到持久 staging 并清理缓存，本提案只改变「何时、在哪个线程复制」，两者在 `confirmShareUpload()` 附近交汇但职责不重叠；若两提案先后实施，后实施的一方按对方的最终代码形态适配即可。
- 文档需同步 `docs/Flutter架构设计.md` 中分享导入链路的描述。
