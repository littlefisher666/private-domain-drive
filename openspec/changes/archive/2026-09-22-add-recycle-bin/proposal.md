## Why

现有删除操作会直接删除 OSS 对象，误删后无法恢复。已在 Bucket 中配置 `shared/.trash/` 前缀对象在最后修改时间满 30 天后自动清理的生命周期规则，需要客户端将删除流程改为可恢复的软删除。

## What Changes

- 将单文件、文件夹和批量删除改为移入 OSS 回收站，而非直接删除。
- 新增 macOS 与 Android 共用的回收站浏览、恢复和到期提示界面。
- 在恢复路径被占用时创建不冲突的“已还原”名称，不覆盖现有内容。
- 将删除确认和产品文档由“不可恢复”更新为“30 天内可恢复”。

## Capabilities

### New Capabilities

- `recycle-bin`: 回收站软删除、浏览与恢复能力。

### Modified Capabilities

- `batch-file-operations`: 批量删除改为移入回收站并展示可恢复语义。
- `workspace-item-actions`: 桌面右键删除使用回收站确认文案。

## Impact

- 客户端工作区状态、OSS 仓储层、路由和页面组件。
- 项目需求、技术与 Flutter 架构文档。
- 复用现有 OSS 官方 SDK 的复制、列举与删除操作；不新增 FC 接口、数据库或第三方依赖。
