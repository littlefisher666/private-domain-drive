# Design

## Context

现状（`client/`）：

- 上传/下载队列集中在 `AppController`（`lib/shared/state/app_controller.dart`）：`_enqueueTransfer` + `_drainTransferQueue`（并发上限可配），任务模型 `TransferTask`（`lib/features/transfer/domain/transfer_task.dart`）已实现完整 `toJson`/`fromJson`。
- 持久化仅有终态历史：`_persistTransferHistory()` 将 success/canceled 任务写入 SharedPreferences key `transfer_history:v1`，启动时 `_restoreTransferHistory()` 恢复；pending/running/failed 不持久化，队列闭包 `_QueuedTransfer` 纯内存。
- 分享导入：原生 `MainActivity.kt` 将分享 URI 拷贝到 `cacheDir/shared-import/`，Dart 侧 `confirmShareUpload()` 将 `_pendingShareItems` 逐个 `uploadFile()`；上传对象键在队列闭包内由内部目录路径 + 文件名拼出，`TransferTask.target` 仅存展示路径。
- 应用被杀后：内存队列与 `_pendingShareItems` 全部丢失，`cacheDir` 还可能被系统清理。

动机见 proposal.md，行为契约见 specs/。

## Goals / Non-Goals

**Goals:**

- 入队后的上传任务跨进程存活：退出重开后在传输中心看到「已中断」任务并可继续/放弃。
- 分享/相册来源的待上传文件迁移到持久目录，不依赖 `cacheDir`。
- 恢复时校验源文件，缺失任务标记失败并说明原因。
- 单端实现、Android 与 macOS 共用逻辑，平台差异仅限路径获取。

**Non-Goals:**

- 前台服务 / 后台保活（另行提案）。
- 下载任务的持久化与恢复（沿用现状，下载源是 OSS 对象，重启后本来就能重新下载）。
- OSS 分片断点续传（恢复任务从头重传单个文件）。
- 应用退出前尚未确认目录的分享导入清单持久化（`_pendingShareItems` 仍为内存态；确认入队后才进入本能力范围）。
- 引入数据库。

## Decisions

### D1. 持久化介质与结构：SharedPreferences + JSON 列表（新 key）

新增 key `upload_pending:v1`，存 `List<TransferTask.toJson()>`（仅上传、非终态任务）。复用现有 `TransferTask` 序列化与 `_persistTransferHistory` 的异步写入模式。

- 备选：sqlite/drift、独立 JSON 文件。几百条小 JSON 记录远未到需要数据库的量级，与项目「不轻易引入数据库」约束一致；独立文件相比 SharedPreferences 无额外收益。

### D2. 中断状态建模：新增 `TransferTaskStatus.interrupted`

恢复出的未完成任务统一标记为 `interrupted`，而不是复用 `failed`：两者语义不同（失败发生在运行中、有错误信息；中断表示「上次进程未跑完」），且规格已将两者区分为不同的操作集合与排序位置。历史记录 JSON 中旧数据不会出现该值，向后兼容；传输中心需要为该状态补充徽章文案与颜色。

### D3. 任务持久化字段：扩展 `TransferTask.targetDir`

持久化需要能重建对象键，但现闭包内的内部目录路径没有存进任务。新增可选字段 `targetDir`（内部目录路径，如 `/共享空间/照片/`），入队时写入；对象键在继续上传时按既有闭包逻辑重建（`targetDir + name`），与现有重试路径完全一致，冲突解析（跳过/覆盖/保留两者）也自然复用。

- 备选：持久化最终对象键。但冲突解析发生在闭包运行期，运行中进程被杀时无法保证已解析的键回写；重建闭包重跑冲突检查更简单且行为正确。
- 运行中任务恢复后 `transferredBytes` 归零、从头重传（OSS SDK 无断点续传，见 Non-Goals）。

### D4. staging 目录与迁移规则

使用 `path_provider` 的 `getApplicationSupportDirectory()`（app 私有、系统不清理）下新建 `upload-staging/`。判定规则：源文件路径位于应用缓存目录（`getTemporaryDirectory()`）之下 → 入队前 move 到 `upload-staging/<taskId>-<fileName>` 并以新路径入队；否则（macOS 本地磁盘、下载等持久路径）直接使用原路径。同一文件系统内 move 是 rename，开销可忽略。分享链路在 `confirmShareUpload()` 统一迁移，app 内 file_picker 链路在 `uploadFile()` 入口迁移，两条链路共用同一迁移函数。

- 备选：原生端直接写入持久目录。改动原生分享桥且 macOS 无对应分享链路，收益小；Dart 侧统一处理双端一致。
- staging 清理时机：任务成功、任务被放弃、任务失败后被用户移除时删除对应文件；文件清理以「sourcePath 位于 staging 目录内」为判定依据，不需要额外映射表。

### D5. 恢复流程：bootstrap 阶段一次性恢复，不自动入队

`AppController` 初始化（现有 `_restoreTransferHistory` 调用点附近）读取 `upload_pending:v1`：逐条反序列化 → 校验 `sourcePath` 文件存在 → 存在则转 `interrupted` 入列，缺失则转 `failed`（message「源文件已丢失」）并只入终态历史、不入未完成记录。恢复后立刻用清理后的列表回写持久化 key。恢复出的任务进入既有排序体系（见 transfer-queue-management 增量规格）。

### D6. 继续与放弃操作

- 继续上传：复用现有任务重试路径——按单个任务转回 `pending` 并以原 `sourcePath`/`targetDir`/`batchId` 重新入队；闭包内既有 `ensureSessionReady` 会先恢复会话，未登录时走既有会话恢复流程。
- 批量便利入口：存在 interrupted 任务时，在传输中心提供「全部继续」/「全部放弃」，逐个调用单任务操作。规格仅要求不强制整批处理，批量入口是纯便利，不做复杂的部分选择 UI。
- 放弃：任务转 canceled 移出未完成记录，按 D4 规则清理 staging 文件。

### D7. 持久化写入时机：仅状态迁移时写，进度不写

上传进度回调高频（字节级），若每次进度都写持久化会造成可观 IO。仅在下述状态迁移时整表重写：入队、running、failed、success、canceled、interrupted 恢复。被杀时最多丢失「最后一次状态迁移之后」的信息，表现为多恢复出几个 interrupted 任务，可接受。

## Risks / Trade-offs

- [几百个文件未传完时 staging 占用双倍空间（原缓存拷贝 + staging）] → 迁移用 move 而非 copy，实际只占用一份；仅缓存外持久路径文件不迁移。
- [SharedPreferences 大 JSON 写入阻塞] → 沿用现有 `unawaited` 异步写入；记录数为几百条量级，单次序列化毫秒级。
- [运行中任务恢复后从头重传大文件] → 一期接受；后续可评估 OSS 分片断点续传。
- [恢复出的任务依赖会话恢复] → 继续上传走既有 `ensureSessionReady`，未登录时任务保持 interrupted/failed 并提示，不阻塞应用启动。
- [ interrupted 状态对现有 UI 的枚举遍历遗漏] → 新增枚举值后用 Dart 端 switch 穷举（exhaustive check）兜底，`switch` 缺分支编译报错。

## Migration Plan

- 纯客户端改动，随 APK 发版；无服务端与数据迁移。
- 旧版本升级后首次启动：`upload_pending:v1` 不存在 → 无恢复任务，行为与现状一致；`transfer_history:v1` 读取逻辑不变。
- 回滚：新版本卸载或回退到旧版本后，旧代码忽略新 key，无残留影响（staging 文件随应用卸载清理）。

## Open Questions

无。
