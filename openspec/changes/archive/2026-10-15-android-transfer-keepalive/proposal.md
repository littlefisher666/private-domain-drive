# Proposal

## Why

Android 端息屏或锁屏后，应用进入后台即遭系统省电机制（Doze 冻结网络与 CPU、后台进程回收）处置，Flutter 引擎挂起、上传/下载任务随之中断；大批量照片上传时用户必须一直亮屏等待，体验不可接受。需要引入 Android 官方的前台服务（dataSync 类型）机制，让系统在传输进行期间不冻结本应用进程。

## What Changes

- **新增 Android 前台传输保活能力**：自研轻量 Kotlin 前台 Service（dataSync 类型）+ MethodChannel，在存在活跃传输任务（进行中或等待中）时启动服务，挂常驻通知展示传输进度；队列空闲（无进行中且无等待中任务）时停止服务并移除通知。
- **通知样式**：进行中常驻通知在 Android 16+ 使用 Live Updates API（`Notification.ProgressStyle` + `requestPromotedOngoing` + `setShortCriticalText`）发送——ColorOS 16 等系统会将其渲染为刘海位置的流体云胶囊（灵动岛），展示「已完成 X/N · Y%」（Y% 为本批次按文件数计的完成百分比）；低版本回退系统标准文字样式（标题 + 正文 + 进度条），均静默不悬浮。胶囊渲染有系统准入链路：除 `POST_PROMOTED_NOTIFICATIONS` 权限外，ColorOS 16 还要求用户在系统设置中开启「流体云显示实时活动」开关（AppOp 默认 ignore），未开启时通知仍静默常驻通知栏、保活不受影响；胶囊为系统固定模板（图标居左、文本居右、中间留白），App 侧不可自定义布局。队列全部完成时弹出「传输完成」悬浮横幅（标准文字通知，HIGH 静音渠道），点击清除并回应用。
- **通知权限申请**：Android 13+ 在首次发起传输时请求 `POST_NOTIFICATIONS` 运行时权限；用户拒绝时服务仍启动（保活不受影响），仅通知不展示。
- **平台边界**：仅 Android 启用；macOS 不引入任何前台服务概念，平台判断收敛在基础设施适配层。
- 用户手动划掉应用（recents 中移除任务）视为主动结束，前台服务随之停止；未完成任务沿用既有 `upload-persistence` 中断恢复机制兜底。

## Capabilities

### New Capabilities

- `android-transfer-foreground-service`: Android 平台在有活跃传输任务时以前台服务保活进程与网络、以常驻通知展示进度，并在队列空闲后及时退出前台状态的能力边界与行为口径。

### Modified Capabilities

（无——传输队列、进度计算、排序、持久化等既有需求口径不变；本变更只新增 Android 平台层的保活行为）

## Impact

- `client/android/`：新增 Kotlin 前台 Service、通知渠道构建、MethodChannel handler；`AndroidManifest.xml` 新增 `FOREGROUND_SERVICE`、`FOREGROUND_SERVICE_DATA_SYNC`、`POST_NOTIFICATIONS`、`POST_PROMOTED_NOTIFICATIONS`（Android 16 Live Updates 准入）权限与 service 声明。
- `client/lib/shared/state/app_controller.dart`：传输队列启停/进度变化处接入前台服务的启停与通知更新（经平台适配层）。
- `client/lib/shared/`（或 `core/`）新增轻量平台适配封装：前台服务启停、通知更新、通知权限请求，`Platform.isAndroid` 判断收敛于此，macOS 为 no-op 实现。
- 对应单测（`client/test/`）与 `docs/Flutter架构设计.md`、`docs/技术文档.md` 中涉及传输后台行为的描述同步更新。
