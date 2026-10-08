## 1. 上传批次模型

- [x] 1.1 `client/lib/shared/state/app_controller.dart`：`uploadFile` 增加可选 `batchId` 参数并写入 `TransferTask`（模型字段已存在，无需改模型）
- [x] 1.2 `confirmShareUpload` 为整批分享导入生成 batchId 并传入每个 `uploadFile`
- [x] 1.3 `client/lib/features/workspace/presentation/workspace_page.dart`：`pickAndUploadFiles` 与 `pickAndUploadDirectory` 为一次提交的多文件生成 batchId 并传入
- [x] 1.4 批次概念从界面移除：删除 `_BatchSummaryStrip`、`TransferBatchSummary` 聚合与 `cancelBatch`；batchId 保留为内部机制，仅用于上传冲突处置的「整批应用」（最终实现中按用户要求调整，不再展示批次汇总）

## 2. 移动端传输页固定统计头部与速度展示

- [x] 2.1 移动端布局从单个 `ListView` 重构为 `SafeArea(Column(固定头部, Expanded(任务列表)))`，头部含标题行、单行统计行、文字 Tab 类型筛选，卡片渲染代码保持不变
- [x] 2.2 统计行新增汇总：未完成任务总字节进度（transferredBytes/totalBytes 求和）与全局速度（进行中任务 bytesPerSecond 求和），格式化复用现有 `_formatBytes`；统计行保持单行展示，任务总数由筛选 Tab 计数承担
- [x] 2.3 移动端进行中任务卡片进度行接入 `_transferDetails`（已传输 / 总字节 · 速度），与桌面口径一致；总量未知仅显示已传输量
- [x] 2.4 `flutter analyze` 通过，并在 Android 真机上验证：长列表滚动时统计行常驻可见、速度实时刷新、筛选切换正常、空列表展示正常

## 3. 上传存在性校验

- [x] 3.1 `AppController` 在 `uploadFile` 的 `_QueuedTransfer` 闭包内、上传前调用 `objectExists(objectPath)`；不存在直接继续上传，重试路径同样覆盖
- [x] 3.2 实现已存在处置决策：跳过（标记 success、message「已存在，跳过」）、覆盖（原键上传）、保留两者（仿照 `_availableRestorePath` 探测「（1）」序号新键上传）
- [x] 3.3 处置对话框：通过全局 navigatorKey 弹出（与 ShareTargetDialog 同模式），含整批应用勾选项；同批其余任务按整批决策自动处置，不逐个弹窗
- [x] 3.4 应用后台或对话框不可见时任务保持等待确认状态，不标记失败；回前台后可完成决策
- [x] 3.5 Android 真机验证：单文件覆盖/保留两者/跳过三路径、分享导入多文件整批应用、批量预检随并发调度并行（widget 测试覆盖三路径与整批应用，真机完成传输页交互验证）

## 4. 回归与收尾

- [x] 4.1 macOS 桌面端回归：桌面布局不受移动端重构影响，存在性校验在桌面正常工作（桌面布局测试与全量单测通过；批次汇总条按最终口径双端移除）
- [x] 4.2 传输历史持久化回归：重启后已结束任务（含「已存在，跳过」）恢复正常展示（历史恢复单测通过，batchId 字段已在模型中持久化）
- [x] 4.3 在 client 子仓库提交实现，主仓库更新 submodule 指针并归档 change，同步归档规格到 `openspec/specs/`

## 5. 实施中追加的用户调整

- [x] 5.1 移动端统计行压缩为单行、筛选改为文字 Tab、批次条紧凑化（最终批次条整体移除）
- [x] 5.2 传输任务排序：进行中 > 等待中 > 已结束，同状态内新任务在前，双端共用
