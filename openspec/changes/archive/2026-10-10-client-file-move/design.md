## Context

客户端（Flutter，Android + macOS）直连 OSS，文件操作均由客户端组合完成。现有基础设施：

- `OssClient`（`client/lib/features/workspace/infrastructure/oss_client.dart`）已具备 `copy`、`delete`、`deleteMany`、`listAllObjectKeys`（递归分页列全部 key）、`objectExists`
- `AppController.renameItem` = 同目录 copy + delete，仅处理单个 key（对文件夹丢子对象）
- `AppController._moveToRecycleBin` 是最完整的"逐对象 copy + manifest + 批量 delete"模板
- 多选状态机（`isMultiSelectionMode`、`enterMultiSelection/toggleMultiSelection/clearMultiSelection`）与批量删除流程已存在
- OSS 标准 Bucket 无服务端原子 move；`CopyObject` + `DeleteObject` 组合是唯一路径

OSS key 约定：根前缀 `shared/`；文件夹为 key 以 `/` 结尾的空标记对象；目录内容以目录前缀递归展开。

## Goals / Non-Goals

**Goals:**

- 单条目与多选批量移动到任意目录（含根目录）
- 中断后可恢复：冷启动检测未完成的移动，支持"继续"（幂等重跑）与"撤销"（反向搬运）
- 移动过程对用户呈现进行中状态，完成后统一刷新列表
- 文件夹移动不丢子对象（含目录标记对象）

**Non-Goals:**

- 不引入 OSS HNS Bucket / RenameObject（需重建 Bucket，一期不做）
- 不做跨 Bucket、跨账号移动
- 不做移动进度断点的细粒度记录（依赖操作幂等性而非逐对象状态账本）
- 不做两阶段提交式的临时前缀中转（移动期间目标目录短暂不完整由 UI 状态遮盖）
- 不支持移动到回收站或从回收站移动（回收站走既有恢复流程）

## Decisions

### D1：执行顺序为"分批并发 copy → 每批 deleteMany 删源"（实施期修订）

原方案为逐对象 copy → 成功即 delete 源；实测个人网盘规模下请求往返延迟明显（每对象 2 次 RTT 串行），实施期修订为：对象分批（并发 6）并发 `copy`，每批复制完成后以 `deleteMany` 一次删除该批源对象。请求量接近减半，且仍保持批次粒度的幂等（重跑 = 对已完成对象 copy 覆盖自身 + delete 幂等），中断残留上限为一批对象在两侧短暂重复，"继续"仍无需任何进度账本。

- 备选 A（原逐对象即删）：删除粒度最细，中断残留最少，但每对象 2 次串行 RTT，实测体验过慢。保留为小批量（≤ 并发数）时的自然形态。
- 备选 B：临时前缀两阶段中转。请求量翻倍且污染递归列举。否决。
- 选择分批 copy + 批内 deleteMany 的理由：幂等语义不变（单对象 copy 先于其源 delete），删除请求从 N 次降为 N/6 次左右，复制阶段天然并发。

### D2：manifest 粗粒度，只记"任务存在"，不记逐对象状态

移动开始前以 `uploadText` 写入 manifest，全部完成或撤销后删除。存放于 `shared/.moves/<id>/manifest.json`（独立于 `.trash/` 前缀，避免回收站列表误显示）。

内容（JSON，字段对齐 `RecycleBinEntry` 的风格）：`id`、`sourcePrefixes`（List，多选批量移动时为多个源）、`targetPrefix`、`createdAt`。**不记录**逐对象 copy/delete 进度——幂等性使重跑天然正确。

- 备选：逐对象进度账本。能精确显示剩余数量，但每对象多一次 manifest 重写请求，且与幂等重跑冗余。否决，一期不做。

### D3：冷启动恢复 = 检测残留 manifest → 用户二选一

应用恢复会话后（`ensureSessionReady` 之后）list `shared/.moves/` 前缀：

- 无残留：无动作
- 有残留：向用户列出任务（源 → 目标、发起时间），提供「继续移动」与「撤销移动」
  - **继续**：直接对 `sourcePrefixes` 重跑整个移动（幂等；已搬走的对象 list 不到了，自然跳过）
  - **撤销**：反向执行——把 `targetPrefix` 下已存在的对象搬回 `sourcePrefixes` 对应位置，同样逐对象 copy→delete
  - 两种操作完成后删除 manifest

选择用户显式选择而非自动续跑：中断原因未知（可能是用户反悔），撤销权优先。多个残留 manifest 按时间逐个提示。

### D4：冲突与合法性校验在移动前一次性完成

- 自包含校验：目标目录不得等于源目录本身、不得位于任何源文件夹前缀之下（字符串前缀判断即可，OSS key 无软链接）
- 重名冲突：对每个待移动条目用 `objectExists` 检查目标路径；存在则弹冲突对话框，提供「跳过 / 仅保留两者（自动加后缀，如 `名称 (2)`）/ 取消整个移动」。默认不覆盖——覆盖会破坏"中断重跑幂等"的安全性（重跑覆盖的可能是用户新放入的文件）
- 批量选择含父文件夹与其子文件时去重（父前缀已覆盖子路径），与批量下载的既有语义一致

### D5：状态与入口挂在 AppController，UI 复用既有模式

- `AppController` 新增：`isMoving` 状态 + 进度（已处理/总数）、`moveItems(List<FileItem>, String targetDir)`、`resumePendingMoves()/undoPendingMove()`
- 移动为独占式前台操作：进行中禁止再次发起移动（简单互斥即可，不做并发移动队列——一期个人网盘场景无并发需求）
- 入口：
  - 桌面右键菜单/移动端更多菜单：新增「移动到…」（与重命名并列）
  - 批量操作栏：新增「移动」按钮（需同步修改 `batch-file-operations` 规格，移除"不展示移动"的限制）
- 目录选择对话框：新 widget，面包屑导航 + 目录列表（复用 `OssClient.list`），仅展示文件夹；禁止选中当前源所在目录场景中非法的目标
- 进行中状态：目标目录与源目录列表页显示移动进行中提示（角标/遮罩），完成或失败后统一 `refresh`；期间不自动中断用户浏览

### D6：文件夹移动的展开方式

对文件夹源：`listAllObjectKeys(sourcePrefix)` 取全部子 key，加上文件夹自身的目录标记 key（`sourcePrefix` 本身），逐个映射 `dst = targetDir + key.substring(sourceParentPrefix.length)`。空文件夹仅搬标记对象。

### D7：执行改为"边列举边搬运"流水线（实施期第二次修订，性能）

原实现（D1 落地形态）是先把全部子 key 递归列举完、构建完整 work 列表后再开始搬运。实测确认移动后存在明显空转：用户确认目标后进度横幅停在 0/0 数秒——列举按每 1000 key 一页串行翻页（每页一次 OSS 往返），一个大文件夹仅"数数"就要数十次串行请求，期间无任何对象被搬运。修订为：

- **流式执行**：`_runMovePlan` 不再先收集全部 key；递归列举每返回一页（≤1000 个 key）即把该页对象按批（并发 6）投入 copy → 批内 deleteMany 的搬运流程，列举下一页与当前页搬运并发进行。总耗时 ≈ max(列举, 搬运) 而非两者相加。撤销（反向搬运）路径同样流式化。
- **分页与删除并发的正确性**：OSS 按 key 字典序分页，marker 为上一页最后一个 key；被删除的源 key 均 ≤ marker，不影响后续分页结果，列举与删除可安全并发。
- **进度口径**：进度仍以「已处理/总数」展示，但总数在列举完成前随每页结果递增；总数旁展示统计中标识（小 loading 图标），鼠标悬浮提示"仍在统计待迁移文件总数"。列举完成后标识消失，进入确定的 x/total。
- **幂等语义不变**：单对象 copy 先于其源 delete 的不变式在页粒度批次上依旧成立；manifest 仍只记"任务存在"。唯一代价是中断残留上限从"一批（6 个对象）"放大为"一页（≤1000 个对象）"在两侧短暂重复——续迁时这些重复对象被幂等逻辑自然消化（源已消失即跳过），可接受。

### D8：目录选择对话框改用轻量前缀列举（实施期修订，性能）

目录选择对话框原本复用工作区浏览的 `OssClient.list`，该方法会对当前目录下每个子文件夹发起 `_readDirectorySummary` 分页统计（1 + F 次以上请求）以显示"文件夹 · N 项"——而对话框只展示文件夹名称、不显示统计数量，这些请求纯属浪费，导致打开目录选择器明显卡顿。修订为：对话框数据源改为仅前缀列举（`listPrefixes`，delimiter 模式拿 commonPrefixes，进入一个目录 1 次请求），不做任何子内容统计。

## Risks / Trade-offs

- [大文件夹移动慢且不可取消-进行中] → D7 流式执行后列举与搬运重叠，确认后不再有 0/0 空转阶段；不可取消一期仍接受（与回收站删除同量级）；互斥锁防止并发发起；后续如需后台化可扩展
- [逐对象 delete 请求量大（1000 文件 = 2000 次请求）] → 已按批聚合 deleteMany 落地（并发 6 一批）；如成瓶颈可增大批或并发度
- [D7 流式化后中断残留上限从一批（6）放大到一页（≤1000）对象双侧短暂重复] → 续迁幂等消化（源已消失即跳过），仅"继续"时重 copy 最多一页，接受
- [撤销时源位置被新对象占用] → 撤销沿用 D4 的冲突策略（自动加后缀），不得覆盖
- [manifest 写入后、任何对象搬运前中断] → "继续"会重跑一遍（全量 copy，无浪费，因为对象本来就还在源位置）；"撤销"发现目标侧为空，仅删 manifest
- [`.moves/` 前缀被 gallery/回收站等递归扫描误显示] → 实现时核对 `_galleryHooks` 与 `.trash/` 的排除逻辑，为 `.moves/` 增加同等排除（参照 `workspace-hidden-entries` 的隐藏约定）
- [移动期间另一台设备并发写同路径] → 一期单用户设备规模，接受 last-writer-wins，不做锁

## Migration Plan

纯客户端新增功能，无数据迁移。发布即生效；未完成移动的 manifest 仅由新版客户端识别（旧版会忽略 `.moves/` 前缀下的对象，不产生破坏）。回滚 = 回退客户端版本，残留 manifest 不影响旧版任何流程。
