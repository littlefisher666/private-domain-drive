# Design

## Context

现状（`client/`）：

- 分享接收：`MainActivity.kt` 在 `configureFlutterEngine`（冷启动）与 `onNewIntent`（热启动）中调用 `receiveShareIntent()`，其内部 `copySharedFiles()` 在**主线程**逐个把分享 URI 复制到 `cacheDir/shared-import/`，全部完成后才一次性通过 EventChannel 发出整批列表或写入 `pendingItems`。
- Dart 侧：`AndroidShareImportBridge` 提供 `incomingItems` 流（整批列表）与 `takePendingItems()`（冷启动兜底）；`app.dart` 以「待上传项 id 拼接串」作为防重入签名，弹目录选择弹窗；`ShareTargetDialog` 确认后 `confirmShareUpload()` 逐个入队上传。
- 问题：主线程同步复制导致大批量分享时 UI 无响应（ANR 风险）；整批完成前无进度反馈；复制到一半被杀则缓存残留（缓存清理归 `add-upload-persistence-resume` 提案处理，本提案不涉及）。

## Goals / Non-Goals

**Goals:**

- 分享复制全程不占用主线程，大批量分享时应用可正常操作。
- 每个文件复制完成即推送到 Flutter 侧，目录选择弹窗实时展示导入进度。
- 批次复制完成前禁止确认上传，保证确认时待上传清单完整。
- 修复后台化引入的冷启动竞态，任何时序下分享内容不丢失、不重复弹窗。

**Non-Goals:**

- 分享导入文件的持久 staging 与缓存清理（`add-upload-persistence-resume` 提案范围）。
- 复制进度上传到通知栏/前台服务（无后台保活诉求）。
- 相册单次分享数量上限调整（由发送方相册 App 决定，App 端无法影响）。
- macOS 端改动（无系统分享导入链路）。

## Decisions

### D1. 复制后台化：单线程 Executor，每批次一个后台任务

`receiveShareIntent()` 收到 Intent 后仅解析 URI 列表（轻量，留在主线程），文件复制整体提交到 `Executors.newSingleThreadExecutor()`。单线程保证多次分享的批次按到达顺序串行复制，避免并发写 `cacheDir/shared-import` 引入的新竞态；复制本身是 IO 密集，单线程吞吐足够。

- 备选：协程（需引入 kotlinx-coroutines 依赖）、多线程池。项目「保持轻量」约束下不想为一处后台化引依赖；多线程池在缓存目录命名已含 UUID 前缀的前提下并发安全，但收益为零，不如串行简单可控。

### D2. 事件协议：信封格式（batch_start / item / batch_done）

EventChannel 事件从「整批 `List<Map>`」升级为带类型的信封 Map：

- `{"type":"batch_start","batchId":...,"total":n}`：批次开始，total 为解析出的 URI 数。
- `{"type":"item","batchId":...,"item":{...同现有字段...}}`：单个文件复制成功。
- `{"type":"batch_done","batchId":...,"succeeded":n,"failed":m}`：批次结束，附成功/失败计数。

`batchId` 用 `UUID` 生成，同一 Intent 只产生一个批次。复制失败的文件跳过不推送 item，失败数在 batch_done 中体现，弹窗据此提示「n 个文件导入失败」。

- 备选：保持整批事件不变、仅后台化（Flutter 零改动）。实现最省，但大批量分享时用户在弹窗弹出前依旧无反馈，且「流式」诉求落空；信封协议改动集中在桥接层一个文件，成本可控。

### D3. 冷启动竞态：按 eventSink 监听状态分流，onListen 冲刷缓冲

后台化后「批次完成时 Dart 可能尚未监听事件流」成为新的时序窗口。分流规则：

- 批次任一事件产生时 `eventSink != null`（`onListen` 已调用）→ 实时推送。
- 尚未监听 → 该批次的事件暂存到线程安全的缓冲队列；`onListen` 触发时按产生顺序冲刷全部缓冲事件，之后转为实时推送。
- `takePendingItems()` 保留为兜底：返回缓冲中**已完整**（收到 batch_done）的批次（信封格式），调用后移除；`app.dart` 冷启动路径将其转为「立即完成」的批次处理。极端时序下（Dart 只调 `takePendingItems` 而不监听流）行为与现状等价。

`pendingItems` 与事件缓冲的读写全部收敛到主线程（Executor 回调 post 回主线程再发事件/写缓冲），用主线程串行化替代锁，实现最简单且无死锁风险。

### D4. 批次防重入：签名改为 batchId

`app.dart` 的 `_openedShareSignature` 从「项 id 拼接串」改为批次 id：收到 `batch_start`（或冷启动完整批次）时若该 batchId 未处理过则弹出目录选择弹窗并记录。避免逐项到达导致签名不断变化、反复触发弹窗逻辑；「取消后重新分享同一批内容可再次弹出」的既有规格通过「取消时清除该批次签名」保持不变。

### D5. 弹窗进度与确认时机

`AppController` 新增批次渐进接收接口：`beginShareImportBatch(batchId, total)` / `addShareImportItem(batchId, item)` / `finishShareImportBatch(batchId, succeeded, failed)`，内部维护当前批次状态（总数控自 batch_start，已到项数实时累加），批次完成后并入现有 `pendingShareItems`。

`ShareTargetDialog` 增加进度行：

- 批次未完成：显示「正在导入 x/n」，「上传到此处」按钮禁用。
- 批次完成：`failed == 0` 时按钮启用，文案不变；`failed > 0` 时进度行提示「x 个文件导入失败」，按钮启用（部分成功仍可继续上传剩余文件）。

登录未就绪时批次照常渐进接收（既有逻辑本就允许先攒待上传项、登录后弹窗），无需特殊处理。

### D6. 批次生命周期与进程死亡

复制中途进程被杀：未完成的批次随进程消失，行为与现状一致（现状是主线程复制中被杀同样全丢）；已复制到 `cacheDir` 的残留文件由 `add-upload-persistence-resume` 的 staging 迁移与清理机制兜底。本提案不为复制中途死亡做恢复。

## Risks / Trade-offs

- [逐项事件频率高（上百文件时上百条事件）] → EventChannel 单条事件为小 Map，Flutter 侧逐条追加 notifyListeners 的开销在百级数量可忽略；如未来上千级出现性能问题再合并节流。
- [onListen 冲刷与实时推送交错丢事件] → 冲刷与后续推送同在主线程串行执行，冲刷完成前不发送新事件，顺序有保证。
- [batch_done 先于用户确认到达前用户强杀应用] → 与现状等价（整批复制未入队即被杀），Non-Goal 不做恢复。
- [信封协议与旧格式不兼容] → 协议仅有本仓库桥接层一个消费方，同一次提交内同步升级两端，无兼容包袱。
- [Dart 侧 switch/解析遗漏新事件类型] → 信封 type 解析使用穷举 + 未知类型忽略（向前兼容系统层事件），忽略时打 debug 日志便于排查。

## Migration Plan

- 纯客户端改动，随 APK 发版，无服务端与数据迁移。
- 回滚：还原原生与桥接两端即可，无持久化新状态（batchId 仅内存态）。

## Open Questions

无。
