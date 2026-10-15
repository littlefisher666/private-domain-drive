# Design

## Context

现状（`client/` 子仓库）：

- 传输编排集中在 `AppController`（`shared/state/app_controller.dart`）：`_pendingTransferIds` / `_runningTransferIds` 维护队列，`_drainTransferQueue` 调度，`tasksListenable` 暴露任务列表快照；上传/下载执行闭包最终经平台 OSS SDK 完成，全部运行在主 isolate；
- 客户端目前没有任何 `WidgetsBindingObserver` / 生命周期监听与前台服务处理；AndroidManifest 只声明了 `INTERNET`、`REQUEST_INSTALL_PACKAGES`；
- 依赖面极简（pubspec 无任何保活/后台类插件），平台差异通过 `Platform.isAndroid` 判断、收敛在基础设施层（如 `system_proxy.dart`）；
- 已有 `upload-persistence` 能力兜底：未完成上传任务持久化，冷启动恢复为「已中断」、不自动续传。

约束：一期最小可用；Android 与 macOS 共用传输逻辑，保活必须是纯 Android 平台层增量，不得侵入传输编排逻辑本身。

## Goals / Non-Goals

**Goals:**

- Android 上有活跃传输任务时进程不被系统冻结/回收，息屏、锁屏、切后台传输持续；
- 前台通知展示真实进度（复用队列现有统计口径），空闲即停；
- 集成面最小：AppController 只感知一个平台适配接口，macOS 完全无感（no-op）。

**Non-Goals:**

- 不做「用户划掉应用后传输仍在后台继续」（service isolate 接管传输引擎），划掉即视为主动结束，交给持久化中断恢复；
- 不做下载任务的持久化/断点续传（沿用现状，仅上传有持久化）；
- 不做国产 ROM 自启管理引导页；不在通知上放暂停/取消等操作按钮（一期仅展示+点击回应用）；
- 不引入 WakeLock（前台服务已豁免 Doze 网络限制，无需额外唤醒锁）。

## Decisions

### D1：自研轻量 Kotlin 前台 Service + MethodChannel，不使用插件

选型对比：

- `flutter_foreground_task`：维护活跃、接入成本低，但通知由插件原生代码构建，**无法控制 Live Updates API 的完整准入链路**（`requestPromotedOngoing` extra、`ProgressStyle`、`setShortCriticalText` 等），插件只暴露标题/正文/简单进度条；
- `flutter_background_service`：偏向独立 isolate 跑后台逻辑，与诉求错位，同样不支持自定义通知样式细节；
- 原生 Service + MethodChannel：可完全掌控通知样式与 Live Updates 行为（胶囊渲染、完成横幅、渠道优先级），代价是维护约 200 行 Kotlin（Service、通知构建、渠道、MethodChannel handler），无第三方依赖。

结论：样式诉求决定了走原生自研。自研范围刻意收窄为「保活 + 挂通知」单一职责：Service 不含任何业务逻辑，只暴露 start/update/stop 三个 MethodChannel 方法；传输逻辑仍完整留在 `AppController` 主 isolate，与插件方案下的架构边界一致。

### D2：同进程「保活+通知」模式，`stopWithTask="true"`

前台 Service 与主 isolate 同进程运行：传输执行逻辑仍完整留在 `AppController` 现有队列中，前台服务只承担「让系统不冻结本进程 + 挂通知」。

- 通知更新由 Dart 侧节流后经 MethodChannel 调用 `update`（Service 收到后 `notify()` 刷新通知）；
- service 声明 `android:stopWithTask="true"`：用户从最近任务划掉应用时服务随 Activity 一并销毁，未完成任务落入既有 `upload-persistence` 的「已中断」恢复口径。

备选方案：`stopWithTask="false"` + service isolate 在应用被杀后接管续传。否决——传输闭包持有 OSS client、staging 等主 isolate 状态，独立 isolate 无法无缝接管，等于重做一套后台传输引擎，超出一期范围；且「划掉即停」的行为对用户更可预期（与规格 Requirement「用户主动结束应用时停止服务」一致）。

### D3：启停与通知由队列活跃状态驱动，进度节流更新

AppController 在队列状态变化点（入队、任务启动、任务终态、取消）计算一次「活跃状态 + 进度摘要」，投递给适配层：

- **活跃定义**：`_runningTransferIds` 或 `_pendingTransferIds` 非空。由活跃转为空闲（全部任务到达终态）时立即停止服务；由空闲转为活跃时启动服务；
- **通知内容**：标题「正在传输」，正文「已完成 X/N · Y%」（X/N 为本批次已完成/总任务数，Y% 为按文件数计的本批次完成百分比，与胶囊 `shortCriticalText` 一致）；
- **节流**：进度类更新最短间隔 1 秒（节流 key 含已完成数/总数与百分比，任一变化才推送），活跃状态切换不节流；
- AppController 侧不感知任何 MethodChannel 细节，只暴露一个「状态推送」调用点，便于单测（mock 适配层断言启停时序）。

### D4：平台适配层 `TransferKeepalive`

`client/lib/shared/` 下新增轻量适配：

```
TransferKeepaliveService（抽象接口）
  ├── sync({required bool active, TransferProgressSummary? summary})  // 幂等：内部处理启动/停止/更新
  ├── requestNotificationPermissionIfNeeded()                           // Android 13+ 首次传输前调用
  └── AndroidTransferKeepaliveService（MethodChannel 实现）
      └── 其他平台返回 NoopTransferKeepaliveService
```

- `Platform.isAndroid` 判断收敛在工厂方法内，与 `system_proxy.dart` 的既有模式一致；
- macOS 端实现为 no-op，传输逻辑零改动；
- 通知权限请求在用户首次发起传输（确认上传/下载）时调用，一次性行为，不反复骚扰。

### D5：原生通知样式（Live Updates 流体云胶囊 + 标准文字通知，不用自定义 RemoteViews）

真机联调后确定的最终样式：全部使用系统标准通知形态，不引入自定义 RemoteViews 布局（ROM 渲染差异大、深色卡片观感不可控，已弃用并删除对应布局资源）。

- `NotificationChannel`：**进行中通知**走 `IMPORTANCE_DEFAULT` 静音渠道（`setSound(null, null)`，静默常驻、不悬浮、状态栏渲染小图标；ColorOS 等 ROM 对 `IMPORTANCE_LOW` 渠道不渲染状态栏图标，无法在刘海/挖孔区域展示，故不可用 LOW）；**完成横幅**走 `IMPORTANCE_HIGH` 静音渠道（AOSP 上 DEFAULT 不触发 heads-up，HIGH 才可靠悬浮弹出）；
- **进行中通知（Android 16+ Live Updates）**：`Notification.ProgressStyle`（`setProgress` + `setStyledByProgress(true)`）+ extras 中 `android.requestPromotedOngoing=true` + `setShortCriticalText("已完成 X/N · Y%")`，由 ColorOS 16 渲染为刘海位置的流体云胶囊；低版本回退系统标准文字样式（`setContentTitle` / `setContentText` / `setProgress`）。批次计数（已完成 X/总数 N）由 `AppController` 维护：空闲转活跃时归零，剩余任务数减少即累计已完成、新增任务即扩大批次总数；Y% 为按文件数计的本批次完成百分比（`batchCompleted/batchTotal`），与「已完成 X/N」语义一致，不使用字节进度；
- **Live Updates 准入链路**（真机逆向 + 排查确认）：Manifest 声明 `POST_PROMOTED_NOTIFICATIONS` 权限之外，ColorOS 16 还要求 uid 级 AppOp `POST_PROMOTED_NOTIFICATIONS` 为 allow——该 AppOp 默认 ignore，需用户在系统设置（`android.settings.APP_NOTIFICATION_PROMOTION_SETTINGS` 页）开启「流体云显示实时活动」开关；未开启时通知仍静默常驻通知栏，保活与传输不受影响。胶囊为系统固定模板（图标居左、文本居右、中间留白撑满），App 侧唯一可控内容为 `shortCriticalText`；
- **完成提示**：队列由活跃转为空闲（全部任务到达终态）时，停止前台服务并移除进行中常驻通知，随后以完成渠道发出一条「传输完成」标准文字通知（标题「传输完成」、正文「全部任务已完成」），`setAutoCancel(true)` 用户点击后清除并回应用，heads-up 自顶部弹出、未点击时由系统超时收起；
- 点击 PendingIntent 回到 launcher Activity（`singleTask` 已配置，复用既有实例）；一期不放「打开/暂停」等右侧按钮。

备选方案一：进行中通知也用 `IMPORTANCE_DEFAULT` 首次弹出横幅。否决——传输是用户刚刚在应用内主动发起的操作，弹出横幅属于重复打扰；有信息量的时机是「全部完成」，把悬浮弹出留给完成提示。
备选方案二：完成横幅用自定义 RemoteViews 深色圆角卡片（对齐商店横幅观感）。否决——真机验证发现深色卡片在 ColorOS 通知栏内观感突兀且布局不可控，改用系统标准文字通知后观感一致、维护成本更低。

### D6：Manifest 与权限配置

`AndroidManifest.xml` 新增：

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.POST_PROMOTED_NOTIFICATIONS" />
<service
    android:name=".TransferKeepaliveService"
    android:foregroundServiceType="dataSync"
    android:stopWithTask="true" />
```

`dataSync` 类型与「上传/下载」语义完全匹配，是 Google 官方为该场景指定的类型。

## Risks / Trade-offs

- [Android 15+ 对 `dataSync` 前台服务有每日约 6 小时的运行上限，超时系统回调 onTimeout 并停止服务] → 超时后传输中断，落入既有持久化中断恢复口径；个人网盘日常批量传输远达不到该时长，一期接受并在文档记录。
- [国产 ROM（小米/华为等）有额外的后台管理策略，部分机型对前台服务也会加限] → 前台服务是官方渠道、豁免绝大多数限制；个别 ROM 的极端行为不做代码级规避，仅文档记录「如遇中断可在系统设置中允许后台运行」。
- [用户拒绝通知权限时，个别 ROM 会连带削弱前台服务的保活效果] → 属平台行为，无法在应用侧根治；规格已明确拒绝权限不改变传输行为。
- [新增原生 Kotlin 代码（Service、通知构建、MethodChannel）带来的维护成本] → 范围刻意收窄为约 200 行单职责代码（保活+通知），不含业务逻辑；Dart 侧经适配层隔离，原生侧无任何传输状态存储。
- [自定义 RemoteViews 通知在不同 ROM 上的展示差异（横幅宽度、圆角渲染）] → 已弃用自定义布局，全部使用系统标准通知形态（Live Updates 胶囊 + 标准文字），ROM 差异由系统收敛。
- [ColorOS 16 流体云胶囊渲染要求用户开启「流体云显示实时活动」AppOp（默认 ignore），未开启时胶囊不渲染] → 未开启时通知静默常驻通知栏、保活不受影响；该开关无法被应用静默授予，真机验证通过系统设置引导开启，一期接受「胶囊为可选增强」的口径。
- [流体云胶囊为系统固定模板（图标居左、文本居右、中间留白），无法改为紧凑自适应布局] → 系统对所有 App 通知胶囊统一此结构；紧凑自适应属 OPPO 泛在服务/OML 合作伙伴路线，超出范围，文档记录取舍。
- [进度推送过于频繁引发通知风暴] → 1 秒节流 + 仅在数值变化时更新。

## Migration Plan

纯客户端增量变更，无数据迁移、无接口变化：

1. 先落适配层与 Manifest 配置（macOS 完全不受影响，可先行回归桌面端）；
2. 再接 AppController 队列状态推送；
3. 真机验证息屏/锁屏/切后台三类场景后发布。

回滚策略：还原客户端版本即可，无任何持久化状态需要清理。

## Open Questions

（无）
