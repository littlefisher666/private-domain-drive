# Tasks: fix-transfer-card-progress-overflow

## 1. 移动端卡片进度布局调整

- [x] 1.1 `_buildMobileTaskCard` 进度条改为 Row：进度条弹性填充，右侧固定宽度右对齐展示百分比
- [x] 1.2 进度文案拼接跳过与状态标签相同的 message，仅保留「已传输 / 总字节 · 速度」与不重复的附加信息
- [x] 1.3 底部文字行为空且无重试/取消按钮时不渲染该行

## 2. 验证

- [x] 2.1 `flutter analyze` 无新增告警，`dart format` 已格式化
- [x] 2.2 Android 真机验证：已完成卡片显示「已存在，跳过」且无省略号截断，百分比位于进度条右侧
