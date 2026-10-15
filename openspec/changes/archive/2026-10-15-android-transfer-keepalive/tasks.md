# Tasks

## 1. 原生 Service 与通知样式

- [x] 1.1 在 `client/android/` 新增 Kotlin `TransferKeepaliveService`（dataSync 前台服务，`startForeground` 挂通知，仅保活+通知职责）与 MethodChannel handler（start/update/stop 三方法），并在 `MainActivity` 注册 channel；`AndroidManifest.xml` 新增 `FOREGROUND_SERVICE`、`FOREGROUND_SERVICE_DATA_SYNC`、`POST_NOTIFICATIONS` 权限及 `foregroundServiceType="dataSync"`、`stopWithTask="true"` 的 service 声明。验证：`flutter build apk`（debug）构建通过。
- [x] 1.2 双渠道通知样式：进行中通知走 `IMPORTANCE_DEFAULT` 静音渠道（`setSound(null, null)`，ColorOS 对 `IMPORTANCE_LOW` 渠道不渲染状态栏图标，故不可用 LOW），Android 16+ 用 Live Updates API 发送（`Notification.ProgressStyle` + `android.requestPromotedOngoing` extra + `setShortCriticalText`，ColorOS 16 流体云渲染为刘海位置胶囊，展示「已完成 X/N · Y%」，Y% 为本批次按文件数计的完成百分比；胶囊为系统固定模板：图标居左、文本居右，App 不可自定义布局；渲染前提为 `POST_PROMOTED_NOTIFICATIONS` 权限 + 用户在系统设置开启「流体云显示实时活动」AppOp，未开启时通知静默常驻通知栏、保活不受影响），低版本回退系统标准文字样式；完成横幅走 `IMPORTANCE_HIGH` 静音渠道标准文字通知（`setAutoCancel` heads-up 悬浮、点击清除并回应用；AOSP 上 DEFAULT 不触发悬浮），不使用自定义 RemoteViews 布局。验证：真机（ColorOS 16）确认开启「流体云显示实时活动」后进行中通知以流体云胶囊展示且静默常驻、文案为「已完成 X/N · Y%（文件百分比）」，全部完成后弹出「传输完成」悬浮横幅、点击回应用并清除。

## 2. 平台适配层

- [x] 2.1 在 `client/lib/shared/` 下实现 `TransferKeepaliveService` 抽象接口与工厂方法：`sync({required bool active, TransferProgressSummary? summary})` 幂等处理启动/停止/通知更新，`requestNotificationPermissionIfNeeded()` 处理 Android 13+ 通知权限；Android 实现基于 1.1 的 MethodChannel，非 Android 平台返回 no-op 实现。验证：单测覆盖 no-op 实现与工厂的平台分支；Android 实现冒烟（见 4.x 手动联调）。
- [x] 2.2 在 Android 实现内实现进度通知节流（最短 1 秒间隔、数值变化才更新）与活跃切换的不节流处理。验证：单测用可注入时钟断言节流行为。

## 3. 传输队列接入

- [x] 3.1 在 `AppController` 的队列状态变化点（任务入队、任务启动、任务到达终态、取消）计算活跃状态（`_runningTransferIds` 或 `_pendingTransferIds` 非空）与进度摘要（剩余任务数、本批次已完成/总任务数、按文件数计的批次完成百分比），推送至 `TransferKeepaliveService.sync`；活跃转空闲时触发完成横幅展示。验证：单测以 mock 适配层断言——首个任务启动时收到 `active: true`、全部任务终态后收到 `active: false` 且标记需要完成提示、进度摘要与队列统计一致。
- [x] 3.2 在用户发起上传/下载的入口处调用 `requestNotificationPermissionIfNeeded()`（一次性行为，已请求过不再弹出）。验证：单测断言权限请求只在首个任务发起时调用一次；真机手动验证拒绝权限后传输仍执行（见 4.x）。

## 4. 回归与验证

- [x] 4.1 跑通 `client/` 全量 `flutter test`，修复受影响用例；确认 macOS 端传输行为无任何变化（no-op 路径被现有传输单测覆盖）。
- [x] 4.2 Android 真机手动联调（realme RMX6699 / Android 16 ColorOS 16，按 AGENTS.md 的 dart-define 启动方式）：批量上传期间常驻通知以流体云胶囊展示「已完成 X/N · Y%（文件百分比）」且静默常驻（引导用户在系统设置开启「流体云显示实时活动」AppOp 后验证）、锁屏状态下传输持续推进（adb 后台轮询捕获进度）、全部完成后弹出「传输完成」悬浮横幅、点击回应用并清除、通知权限请求一次性行为生效；服务停止经 `adb shell dumpsys notification` 与队列空闲后无残留确认。
- [x] 4.3 更新 `docs/技术文档.md` 与 `docs/Flutter架构设计.md`：补充 Android 前台传输保活的架构描述（适配层位置、启停时机、dataSync 限制与 ROM 差异说明），确认与实现口径一致。

## Workflow follow-up

- 实现完成后按仓库约定走 openspec archive 流程，归档后同步 `openspec/specs/` 主规格（新增 `android-transfer-foreground-service` 能力）。
- `client/` 子仓库提交后，如主仓库需要记录 submodule 指针变化，回主仓库更新引用。
