# Tasks

## 1. 清单写入合并机制（PhotoIndexRepository）

- [ ] 1.1 在 `PhotoIndexRepository` 中实现清单变更意图队列与单飞行合并写：增量来源（上传/删除/还原/补齐）投递变更意图，串行 RMW 一次性应用积压变更，写完复查积压继续下一轮；冲突退避与超限标记待修复沿用现有口径。新增单测：连续投递多条意图仅触发合并后的清单写、写回内容包含全部积压变更（参考 `client/test/` 现有测试组织方式）。
- [ ] 1.2 `updateManifest` 返回值携带实际写回的清单版本（success 时返回版本号），调用方用于写本地 meta；新增单测覆盖版本回传。

## 2. 上传链路与索引解耦（AppController + GalleryController）

- [ ] 2.1 `AppController._buildUploadClosure` 中 `onMediaUploaded` 调用改为 `unawaited` 后台调度（保留异常日志捕获），上传任务在 OSS 最终成功后立即返回。验证：单测或现有测试断言传输闭包不再 await 钩子完成；手动联调确认任务完成后并发槽立即可用。
- [ ] 2.2 `GalleryController.onMediaUploaded` 重构为「本地副本先行 + 清单写投递合并队列」两级结构（EXIF 解析与 `upsertEntries` 即时执行，远端 RMW 走任务组 1 的队列）。验证：单测覆盖上传后本地副本即时更新、清单写经队列合并。

## 3. 全量扫描写回合并（GalleryController + PhotoIndexRepository）

- [ ] 3.1 `GalleryController` 增加扫描期间记账集合（upsert keys / delete keys），`addUploadedMedia`、`removeDeletedMedia`、`restoreMedia` 在扫描进行中时记录。验证：单测覆盖三个入口的记账行为。
- [ ] 3.2 `fullScan` 写回应用合并规则：剔除扫描期间删除的 key、并入扫描期间 upsert 的条目（先删后传以 upsert 为准）、`replaceEntries` 按合并结果写入；`updateManifest` mutator 叠加远端清单中 key 不在合并结果里的新增条目兜底。验证：单测模拟「扫描期间上传」「扫描期间删除」「先删后传」三种交错，断言写回结果不丢不复活。
- [ ] 3.3 修复扫描写回后本地 meta 版本：使用 `updateManifest` 回传的实际版本写 `writeIndexMeta`。验证：单测断言扫描写回后本地 meta 版本等于远端清单版本，再次 `load()` 不触发全量清单替换。

## 4. 回归与文档

- [ ] 4.1 跑通 `client/` 全量 `flutter test`，修复受影响用例；针对 `specs/photo-index/spec.md` 与 `specs/transfer-queue-management/spec.md` 中的新场景补齐对应测试用例（上传任务完成不被索引延迟、批量上传合并清单写入、扫描期间上传不丢失、扫描期间删除不复活、扫描写回后版本一致）。
- [ ] 4.2 更新 `docs/技术文档.md` 与 `docs/Flutter架构设计.md` 中索引维护相关的描述（上传钩子后台化、清单合并写、扫描合并规则），确认文档与实现口径一致。
- [ ] 4.3 双端手动联调（macOS + Android，按 AGENTS.md 的 dart-define 启动方式）：批量上传 20+ 张照片观察传输任务即时完成、相册时间线后台补齐；扫描进行中上传/删除照片，扫描结束后核对索引条目无丢失无复活。

## Workflow follow-up

- 实现完成后按仓库约定走 openspec archive 流程，归档后同步 `openspec/specs/` 主规格。
- `client/` 子仓库提交后，如主仓库需要记录 submodule 指针变化，回主仓库更新引用。
