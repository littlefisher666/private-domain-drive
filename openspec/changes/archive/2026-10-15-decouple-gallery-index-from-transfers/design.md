# Design

## Context

现状（客户端 `client/` 子仓库）：

- `AppController._buildUploadClosure`（`shared/state/app_controller.dart`）在 OSS 上传成功后 `await _galleryHooks!.onMediaUploaded(...)`，索引增量随传输闭包执行、占用传输并发槽；
- `PhotoIndexRepository.addUploadedMedia` 每次调用做一次完整清单 RMW（`updateManifest`：ListObjects + GET 清单（上限 8MB）+ 复查 List + PUT），批量上传产生 O(N × 清单大小) 流量；
- `fullScan` 以扫描开始时的对象 listing 为准，结束时 `_database.replaceEntries(entries)` 整体替换本地副本、`updateManifest((current) => manifest)` 忽略 current 整体替换远端清单；扫描期间 `addUploadedMedia` / `removeDeletedMedia` / `restoreMedia` 写入的增量会被覆盖（上传条目丢失、删除条目复活）；
- `fullScan` 写本地 meta 时 `version: manifest.version` 恒为 0（bump 发生在 `updateManifest` 内部），远端实际为 N+1，导致下次进相册页 `_syncFromRemote` 必然触发一次全量清单替换。

删除/还原钩子（`onObjectsDeleted` / `onObjectsRestored`）已是 `unawaited` 调用，本次将上传钩子对齐到同一口径。

## Goals / Non-Goals

**Goals:**

- 上传任务成功判定只取决于 OSS 最终成功；索引簿记完全后台化；
- 批量上传场景下清单写合并为一次 RMW；
- 全量扫描写回合并扫描期间的增量变更，消除条目丢失/复活；
- 扫描写回后本地 meta 版本与远端一致。

**Non-Goals:**

- 不改变 OSS 清单对象格式（`PhotoManifest` 编码不变，新旧客户端互通）；
- 不引入服务端索引或清单拆分（分片/事件表等二期方向）；
- 不调整扫描/补齐的并发与带宽策略（错峰优化另行提案）；
- 不改变「登录后即预热索引」的触发时机。

## Decisions

### D1：上传钩子改后台调度，本地副作用先行

`_buildUploadClosure` 中将 `await onMediaUploaded(...)` 改为 `unawaited(...)`（含异常捕获日志）。`onMediaUploaded` 内部保持两级结构：

1. **本地副本先行**：`addUploadedMedia` 的本地部分（EXIF 解析、`upsertEntries`、内存 `_entries` 刷新）仍然尽快执行，保证相册时间线及时出现新照片；
2. **清单写异步合并**：远端 RMW 不再在钩子内直接执行，改为投递到合并队列（见 D2）。

备选方案：把整个 `onMediaUploaded` 投递到队列末尾统一处理。否决——本地 upsert 延迟会让「上传完立刻进相册看不到照片」，用户体验回退。

### D2：清单写入合并队列（单飞行 + 短窗口聚合）

在 `PhotoIndexRepository` 内增加清单合并写机制：

- 增量来源（上传、删除、还原、缩略图补齐）不再各自调用 `updateManifest`，而是把「对清单的变更意图」（新增/替换条目、移除 key 集合）投递进队列；
- 队列以**单飞行串行**方式执行：同一时刻最多一次 RMW 在途；一次 RMW 将积压的全部变更意图一次性合并应用后写回；
- 写完即检查队列是否有新积压，有则立刻进入下一轮（不做固定 debounce 定时器）：批量上传时首个 RMW 可能只含 1-2 条，后续聚合，最坏情况与逐条写的差异在于把 N 次往返收敛为「在途聚合 + 尾部一次」；
- 冲突重试沿用 `updateManifest` 现有退避与 `conflictExceeded → needsRepair` 口径，不变。

备选方案：固定 debounce（如 2s）再写。否决——单张上传场景会引入无谓延迟；单飞行 + 写完复查积压已足够收敛批量场景，且无定时器生命周期管理问题。

### D3：全量扫描写回前合并增量（记账集合方案）

`GalleryController` 在扫描进行期间维护两个内存记账集合：

- `_scanPendingUpserts`：扫描期间 `addUploadedMedia` / `restoreMedia` 写入本地副本的 key 集合；
- `_scanPendingDeletes`：扫描期间 `removeDeletedMedia` 清理的 key 集合。

`fullScan` 写回时应用合并规则：

1. 以扫描结果 `entries` 为基础；
2. 剔除 `_scanPendingDeletes` 中的 key（删除不复活）；若被删 key 同时在 `_scanPendingUpserts`（先删后传），以 upsert 为准；
3. 并入本地副本中 `_scanPendingUpserts` 的条目（上传不丢失）；
4. `replaceEntries` 改为按合并结果整体写（仍是全量写，但内容已合并）；
5. `updateManifest` 的 mutator 由「忽略 current」改为「以合并结果为基础，再叠加写回瞬间远端清单中 key 不在合并结果里的新增条目」——覆盖极小概率的「其他设备扫描期间写入」窗口；
6. 写回成功后 `writeIndexMeta(version: 实际写回版本)`——`updateManifest` 返回值增加写回后的清单版本（或让 mutator 结果回传版本），消除恒 0 问题。

备选方案：写回前重读远端清单做三方合并。否决——远端清单可能数 MB，每次扫描多一次全量下载；记账集合在本地方即可覆盖本设备并发（本设备是扫描期间增量写入的唯一来源，其他设备写入由规则 5 的兜底合并覆盖）。

### D4：`updateManifest` 返回写回版本

`ManifestWriteResult.success` 扩展为携带实际写入的清单版本（改为返回 record 或 sealed result），`fullScan` / 增量路径用它写本地 meta，保证「本地 meta 版本 == 远端版本」不变式。

## Risks / Trade-offs

- [合并队列属内存态，App 在投递后、写回前被杀] → 变更意图丢失，本地副本已有数据、远端清单缺该条；下次 `_syncFromRemote` 版本比较不会发现（远端版本未变）。缓解：与现状一致由「重建索引」全量扫描自愈；本期接受，不引入持久化队列。
- [上传任务提前标记成功，但索引后台失败] → 用户在相册短暂看不到刚传的照片（本地 upsert 失败时）。缓解：本地 upsert 极少失败（SQLite 本地操作）；清单失败走既有 needsRepair 自愈，规格已明确任务状态不受影响。
- [扫描期间记账集合依赖 hooks 都经过 GalleryController] → 若未来新增绕过 controller 的索引写入路径会漏记。缓解：`addUploadedMedia`/`removeDeletedMedia`/`restoreMedia` 均由 controller 唯一入口调用，design 已写明该前提；tasks 中以单测锁定。
- [D3 规则 5 的兜底合并可能保留其他设备写入的已被本机删除的条目] → 仅在跨设备并发删除+同时扫描的极端窗口出现，残留条目下次扫描消化；好于现状（无差别覆盖）。

## Migration Plan

纯客户端行为变更，无数据迁移：本地副本与远端清单格式不变，旧版本清单可直接读写。发布后首次全量扫描（手动重建或待修复触发）即按新合并规则执行；无需回滚数据，回滚 = 还原客户端版本。
