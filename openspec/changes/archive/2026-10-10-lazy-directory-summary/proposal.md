# 提案：目录浏览性能优化（子目录统计懒加载 + 本地缓存）

## Why

当前打开任意目录时，客户端在 1 次前缀列举返回后，会对每个子文件夹调用 `_readDirectorySummary()`，完整翻页遍历该文件夹全部直属对象来计算条目数与最新更新时间（`client/lib/features/workspace/infrastructure/oss_client.dart:74-83`、`112-144`）。打开含 N 个子文件夹的目录实际产生 1 + N 次列表扫描请求，且需等所有统计完成才渲染列表；子文件夹内容多时单个文件夹就要数十次串行分页请求，且每次进入目录都全量重算、无任何缓存，导致"所有位置加载子目录都很慢"。OSS 没有文件夹聚合元数据，该成本完全来自实现方式。

## What Changes

- `OssClient.list()` 不再在返回列表前同步统计子文件夹：目录列表（含子文件夹与文件）仅由 1 次带 `delimiter` 的前缀列举产生，立即可渲染；文件夹条目数与更新时间随后台任务异步补齐。
- 子文件夹统计以受限并发（同时不超过少量请求）逐个执行，单个统计结果返回后即时刷新对应条目，不再互相阻塞。
- 新增目录统计本地缓存（复用客户端已有 sqflite 持久化）：按目录路径缓存条目数与更新时间，进入目录优先展示缓存值，后台异步校准后刷新。
- 客户端写路径（上传、删除、建目录、移动、回收站清理等）对涉及目录的缓存做增量修正或失效，保证缓存不陈旧；缓存不可用时回退为异步统计，不影响功能。
- 目录选择对话框、回收站等既有"不做统计/隐藏条目不计入统计"的行为保持不变（隐藏条目约定见 `workspace-hidden-entries`）。

## Capabilities

### New Capabilities

- `directory-summary-caching`: 文件目录浏览中子文件夹统计（条目数、更新时间）的加载时机、并发约束、本地缓存与写时增量更新行为。

### Modified Capabilities

（无。`workspace-hidden-entries` 对文件夹统计的隐藏约定不受影响；`file-move` 中目录选择对话框"不做内容统计"的场景保持不变。）

## Impact

- 代码：均在 `client/` 子仓库 —— `lib/features/workspace/infrastructure/oss_client.dart`（list 与统计拆分）、`lib/features/workspace/application/load_directory_use_case.dart`、`lib/features/workspace/presentation/workspace_page.dart`（条目异步刷新）、新增目录统计缓存存储（sqflite，参考 `lib/features/gallery/infrastructure/gallery_database.dart` 的模式）。
- 接口：无服务端接口变化；仍为客户端直连 OSS，请求数从"1 + N 次全量扫描"降为"1 次列举 + 后台受限并发统计"。
- 写路径：上传、删除、建目录、移动等操作需触发缓存修正，涉及 `lib/features/transfer/`、`workspace` 相关用例的少量挂钩。
- 文档：归档后无需更新 `docs/`（不涉及接口契约与架构变化）；`docs/Flutter架构设计.md` 若列出 workspace 模块职责需同步核对。
