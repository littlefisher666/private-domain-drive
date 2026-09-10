## Why

当前客户端的文件列表仅支持单选，用户需要逐项发起删除或下载；下载还会为每个文件单独选择保存位置。这使 macOS 上的文件整理和多文件获取效率低，也无法充分利用已有的传输中心来展示任务进度、排队和失败结果。

本次变更为文件工作区提供安全的多选批量操作，并将批量下载编排为可观察、可控的独立文件传输任务。

## What Changes

- 在 macOS 与 Android 文件列表/缩略图中提供多选模式、全选和取消选择。
- 支持批量删除文件及文件夹；删除前展示不可恢复确认，并在部分失败时反馈失败项。
- 支持批量下载已选文件及文件夹：用户一次选择目标目录，递归展开文件夹后逐文件独立下载并保留相对目录结构，不生成 ZIP。
- 将传输中心接入真实的任务队列与单文件进度、排队、取消、重试和批次汇总。
- 在传输中心配置并持久化上传、下载共用的总并发数（1 至 5，默认 3）。

## Capabilities

### New Capabilities

- `batch-file-operations`: 文件工作区的多选、批量删除与批量下载交互和安全约束。
- `transfer-queue-management`: 真实传输任务队列、进度反馈、并发调度与批次状态管理。

### Modified Capabilities

无。

## Impact

- 客户端：`client/lib/features/workspace/`、`client/lib/features/transfer/`、`client/lib/shared/state/app_controller.dart` 与 OSS 访问层。
- 本地平台能力：批量下载需要一次选择目标目录、写入临时文件/目标文件并处理同名冲突。
- OSS：需要支持流式下载、目录递归列举及多对象删除；文件流量仍保持客户端持 STS 凭证直连 OSS，不经过 FC。
- 文档：后续实施时需要同步更新 `docs/PRD.md`、`docs/功能需求.md`、`docs/用户故事.md`、`docs/技术文档.md` 和 `docs/Flutter架构设计.md` 中受影响的能力说明。
