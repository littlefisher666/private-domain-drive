## Context

传输中心现状（代码位置均为 `client/` 子仓库）：

- `lib/features/transfer/presentation/transfer_tasks_page.dart` 存在两套布局：桌面布局（宽度 ≥ 960 或 `desktopChrome`）已是「固定头部 Column + Expanded(ListView)」结构；移动端布局是一个普通 `ListView`，总统计（进行中/等待/总数）是 index 0 的列表头项，随滚动消失，且任务卡片不渲染 `_transferDetails`（速度与字节数，仅桌面布局调用）。
- 任务模型 `TransferTask` 已含 `transferredBytes`、`totalBytes`、`bytesPerSecond` 字段，`AppController._runTransfer` 已用 `_TransferSpeedTracker`（约 100ms 节流）持续写入速度，数据层无需改动。
- 批次模型已存在但仅用于下载：`enqueueDownloads` 生成 `batchId` 并写入任务，`AppController.transferBatches` 聚合出 `TransferBatchSummary`，`_BatchSummaryStrip` 渲染，但标签写死「批量下载」。`uploadFile` 不接受 batchId，分享导入（`confirmShareUpload`）与工作区上传入口（`pickAndUploadFiles` / `pickAndUploadDirectory`）均逐个入队、无批次关联。
- 上传前无任何存在性检查，OSS PutObject 同名直接覆盖。`OssClient.objectExists`（ListObjects maxKeys=1）已存在并被 `_availableRestorePath` 使用。
- 分享导入链路：原生 share intent → `AndroidShareImportBridge` → `prepareShareImport` → `ShareTargetDialog` → `confirmShareUpload` 逐个 `uploadFile`，与工作区上传最终汇入同一队列。

## Goals / Non-Goals

**Goals:**

- 移动端传输页统计信息滚动时始终可见，并展示总字节进度与全局速度。
- 移动端任务卡片显示速度与字节数，与桌面口径一致。
- 上传与下载共用批次汇总机制；分享导入和应用内上传都能看到「N/M 完成 · 进行中 · 等待」。
- 上传前同名校验，用户可选跳过/覆盖/保留两者，批量场景支持整批应用。

**Non-Goals:**

- 内容级去重（秒传）：不做本地哈希、不做云端哈希索引。
- 不改传输并发模型、不改持久化历史机制（`_saveTransferHistory` 仍只保留已结束任务）。
- 不改服务端与 OSS 侧配置；预检复用客户端现有受限密钥的 ListObjects 权限。
- 不重构桌面布局；桌面端仅因批次汇总标签通用化而同步变化。

## Decisions

### D1. 移动端布局：Column 固定头部 + Expanded 列表（对齐桌面结构）

移动端从 `Scaffold(ListView)` 改为 `SafeArea(Column(头部区块, Expanded(ListView)))`，头部区块包含标题行、统计行、类型筛选与批次汇总条。统计行新增汇总数据：总字节数进度（sum of `transferredBytes`/`totalBytes`，仅统计 running/pending 任务）与全局速度（sum of running 任务 `bytesPerSecond`）。

- 备选 `CustomScrollView + SliverAppBar(pinned)`：可行但引入 sliver 结构，且筛选 chips、批量操作条、批次条等非 AppBar 内容也要各自 sliver 化，改动面更大。Column 结构与桌面布局一致，双向维护成本最低。
- 全局速度直接求和 running 任务的 `bytesPerSecond`（每个任务已是时间窗口平滑值），不做独立全局 tracker，避免新增状态与重复平滑逻辑。

### D2. 移动端卡片速度展示：复用桌面 `_transferDetails`

将 `_transferDetails`（已传输/总字节 · 速度）搬到移动端卡片的进度行，沿用现有 100ms 节流的数据更新频率，无额外性能开销。无 `totalBytes` 时仅显示已传输量（与桌面行为一致）。

### D3. 上传批次：`uploadFile` 增加可选 `batchId`，批次汇总按类型渲染

- `uploadFile({..., String? batchId})` 写入任务模型（`TransferTask.batchId` 字段已存在，`toJson/fromJson` 已持久化，无需改模型）。
- 新增 `uploadFiles(...)` / 或在调用侧生成 batchId 后循环调 `uploadFile`：分享导入 `confirmShareUpload` 与 `workspace_page.dart` 的两个多文件入口统一生成 `batch-<时间戳>` 风格 batchId。单个文件上传（桌面拖拽等）不传 batchId，保持现状。
- `transferBatches` 聚合逻辑不变（已按 batchId 分组），`_BatchSummaryStrip` 标签改为按批次内任务类型显示「批量上传：」/「批量下载：」；批次取消按钮复用现有 `cancelBatch`。
- 不为上传引入独立的批量进度页或新路由；批次条本身就是「还剩多少未传完」的答案。

### D4. 上传存在性校验：入队前预检 + 处置决策，粒度放在「批次级一次性询问」

- 时机：在 `uploadFile` 的 `_QueuedTransfer` 闭包内、真正上传前执行 `objectExists(objectPath)`——而非 UI 入口处。这样重试任务同样经过校验，且预检天然随队列并发调度，不阻塞用户继续操作。
- 交互：第一个检测到「已存在」的任务暂停该任务并弹出对话框（跳过 / 覆盖 / 保留两者 / 整批应用同选），其余同批任务的预检等待该决策后按决策结果执行，避免逐个弹窗。
- 「保留两者」：复用/仿照 `_availableRestorePath` 的可用名探测（追加「（1）」「（2）」序号），上传到新对象键。
- 「跳过」的任务直接标记为 `success`，message 标注「已存在，跳过」，计入批次完成数；「覆盖」走现有上传路径不变。
- 备选「UI 入口预检并过滤」：在 `confirmShareUpload` / `pickAndUploadFiles` 里先批量 ListObjects 过滤——交互更前置，但重试路径绕过校验，且文件夹上传需要额外串行/并行编排，逻辑分叉更多。选择队列内校验换取一致性。

### D5. 批量预检并行执行

文件夹上传（可能几十上百文件）时，逐任务在队列内各自预检即可天然并行（受传输并发上限约束）；不单独建预检线程池。每个任务增加一次 ListObjects(maxKeys=1) 请求，量级可接受。

## Risks / Trade-offs

- [每次上传多一个 ListObjects 请求] → 单次轻量；批量场景下受并发上限自然限流；OSS 侧无额外费用等级变化。
- [队列内弹对话框需要跨层通信（AppController → UI）] → 复用 `navigatorKey` 全局上下文弹 Dialog（与 `ShareTargetDialog` 同模式）；App 处于后台时 Dialog 排队等待回前台，任务保持「等待确认」状态不失败。
- [「整批应用」决策持久化到进程内批次对象，与传输历史持久化模型无关] → 应用重启后历史任务本身已是终态，不需要恢复决策。
- [移动端布局重写可能引入小屏回归] → 保留原卡片渲染代码不动，仅外层结构变化；验证覆盖空列表、长列表滚动、筛选切换、批次条多行换行。
- [跳过任务标记 success 可能与「真实成功」混淆] → message 明确标注「已存在，跳过」，与正常「已完成」区分；批次汇总计数口径不变。

## Migration Plan

纯客户端改动，无数据迁移。发布即生效；回滚即回退客户端版本。传输历史 JSON 结构不变（batchId 字段已在模型中）。

## Open Questions

- 无阻塞项。「整批应用」选项文案与默认勾选策略（默认建议「保留两者」以最防误覆盖）在实现阶段可按实测体验微调。

## 实施阶段调整（最终口径）

- 批次概念从界面移除（用户决策）：D3 中的 `_BatchSummaryStrip` 批次汇总条与批次取消入口未保留；batchId 降级为内部机制，仅用于 D4 处置对话框的「整批应用」分组。
- 移动端统计行压缩为单行（进行中/等待 · 字节进度 · 全局速度），任务总数由类型筛选 Tab 计数展示；类型筛选从 ChoiceChip 改为无底色文字 Tab。
- 新增任务排序要求：进行中 > 等待中 > 已结束，同状态内新任务在前，双端共用。
