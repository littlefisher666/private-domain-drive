# Design: fix-transfer-card-progress-overflow

## Context

`_buildMobileTaskCard` 底部进度文案由 `progressLabel · transferDetails · task.message` 拼成单行 `Text`（`maxLines: 1` + `ellipsis`）。`app_controller.dart` 在任务运行中会把 message 设为「进行中」，与卡片右上角状态徽章文案重复，拼接后单行超宽触发截断。

## Goals / Non-Goals

**Goals:**

- 进行中卡片的「已传输 / 总字节 · 速度」完整可见，不出现省略号。
- 百分比有明确视觉锚点，不与文字信息挤同一行。

**Non-Goals:**

- 不改桌面端布局。
- 不处理传输页置顶统计行的截断（此前已另行处理）。

## Decisions

- **百分比移至进度条右侧而非允许换行**：进度条本身已表达进度比例，百分比作为右端固定宽度（38 逻辑像素）的对齐数字，底部文字行随之缩短到「100.5 MB / 166.2 MB · 2.0 MB/s」量级，单行即可容纳；对比放宽 `maxLines: 2`，信息密度不变且卡片高度稳定。
- **按内容去重而非删除 message 字段**：`task.message` 承载「正在确认」「已存在，跳过」等有意义信息，只在文案等于 `_labelForStatus(task.status)` 时跳过拼接，控制器侧不改动。
- **空文案行折叠**：`progressText` 为空且无重试/取消按钮时整行不渲染，避免已完成卡片留出空白高度。
