# Proposal

## Why

当前相册索引维护与正常业务操作互相干扰：上传任务在 OSS 传输成功后仍要等待索引清单的读-改-写（List + GET 清单 + List + PUT，清单上限 8MB）完成才标记成功，批量上传 N 张照片产生 N 次全量清单往返，既拖慢任务完成、又长期占用传输并发槽；更严重的是全量扫描结束时的整体替换（`replaceEntries` + 忽略 current 的清单写回）会覆盖扫描期间发生的增量更新——扫描期间上传的照片从索引中丢失、已删除的照片复活，且本地索引 meta 版本被写成 0 导致每次扫描后下次进相册必然触发一次全量清单替换。

## What Changes

- **上传与索引更新解耦**：上传任务在 OSS 返回最终成功后即标记完成；`onMediaUploaded` 索引增量更新改为后台异步执行（与删除/还原钩子的 `unawaited` 口径对齐），不得占用传输任务生命周期与并发槽。
- **清单写入合并**：同设备短时间内的多次索引增量（批量上传场景）合并为一次清单读-改-写，避免逐张全量清单往返；本地索引副本仍逐条即时更新。
- **全量扫描写回合并并发增量**：全量扫描结束写回本地副本与 OSS 清单时，SHALL 合并扫描期间发生的新增/删除/还原等增量变更，不再整体覆盖：扫描期间上传的条目保留、扫描期间删除的条目不复活。
- **修复扫描写回后的版本记录**：全量扫描写回后本地索引 meta 版本 SHALL 与远端清单实际版本一致，不再恒为 0，避免下次进入相册页触发不必要的全量清单替换。

以上均为客户端行为变更，不涉及服务端接口与 OSS 清单格式。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `photo-index`:
  - 「上传完成触发索引增量更新」：增量更新改为上传任务完成后的后台行为，不阻塞传输任务；新增清单写入合并（批上传合并为一次 RMW）的口径。
  - 「首次使用全量扫描建立照片索引」与「用户手动触发索引重建」：全量扫描结果写回 SHALL 合并扫描期间并发发生的索引增量（新增保留、删除不复活），本地 meta 版本与远端清单版本一致。
- `transfer-queue-management`:
  - 「传输中心展示真实的单文件任务状态」：明确上传任务成功判定仅取决于 OSS SDK 最终成功，上传成功后的相册索引簿记 MUST NOT 延迟任务完成状态或占用传输并发槽。

## Impact

- `client/lib/shared/state/app_controller.dart`：`_buildUploadClosure` 中索引钩子调用方式由 await 改为后台调度。
- `client/lib/features/gallery/application/gallery_controller.dart`：上传钩子的调度与清单合并写队列；全量扫描写回合并逻辑；meta 版本记录修复。
- `client/lib/features/gallery/infrastructure/photo_index_repository.dart`：`fullScan` 写回合并；增量更新的清单写合并入口。
- `client/lib/features/gallery/infrastructure/gallery_database.dart`：可能需要支持合并式写回（替代整体 `replaceEntries` 的调用方式）。
- 对应单测（`client/test/`）与 `docs/`（技术文档/Flutter 架构设计中涉及索引维护的描述）同步更新。
