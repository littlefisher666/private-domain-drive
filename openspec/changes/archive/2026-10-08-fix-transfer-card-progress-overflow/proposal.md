# Proposal: fix-transfer-card-progress-overflow

## Why

Android 真机上传输页移动端任务卡片底部的进度文案出现省略号截断：进行中任务的文案被拼成「60% · 100.5 MB / 166.2 MB · 2.0 MB/s · 进行中」，其中「进行中」与卡片右上角状态徽章重复，导致单行超宽触发 `TextOverflow.ellipsis`，速度与字节数等信息被截断不可读。

## What Changes

- 移动端任务卡片的百分比从底部文字行移至进度条右侧，右对齐固定宽度展示，进度条收缩为进度条行内的弹性填充部分。
- 底部文字行仅保留「已传输 / 总字节 · 速度」及与状态不重复的附加信息（如「正在确认」「已存在，跳过」）；与状态徽章文案相同的 message（如「进行中」「已完成」）不再重复拼接。
- 底部文字行为空且任务无重试/取消操作按钮时，不再渲染该行，已完成卡片更紧凑。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `transfer-queue-management`: 修改「移动端任务卡片展示速度与字节数」需求——百分比展示在进度条右侧，底部文字行不得与状态徽章重复拼接状态文案。

## Impact

- 客户端 `client/lib/features/transfer/presentation/transfer_tasks_page.dart`：`_buildMobileTaskCard` 进度条改为 Row（进度条 + 右侧百分比），进度文案拼接跳过与状态标签相同的 message，空文案行折叠。
- 桌面端布局不受影响。
- 已在 Android 真机（RMX6699）验证：进行中卡片进度信息完整无截断，已完成卡片显示「已存在，跳过」等附加信息。
