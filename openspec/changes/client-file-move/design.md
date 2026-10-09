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

### D1：执行顺序为"逐对象 copy → 成功即 delete 源"

每处理一个 key：先 `copy(src, dst)`，成功后立即 `delete(src)`（聚合到每 1000 个一批后 `deleteMany` 亦可，但删除粒度越细，中断残留越少——采用每对象独立 delete，代码同样简单）。

- 备选 A（现有模板做法）：全部 copy 完再批量 delete。中断时大量对象在两侧重复，且重跑需要区分"已 copy 未 delete"与"未 copy"两种状态。否决。
- 备选 B：临时前缀两阶段中转。请求量翻倍且污染递归列举。否决。
- 选择逐对象即删的理由：操作幂等（重跑 = 对已完成对象 copy 覆盖自身 + delete 幂等），中断最坏残留一个重复对象，"继续"无需任何进度账本。

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

## Risks / Trade-offs

- [大文件夹移动慢且不可取消-进行中] → 一期接受（与回收站删除同量级）；互斥锁防止并发发起；后续如需后台化可扩展
- [逐对象 delete 请求量大（1000 文件 = 2000 次请求）] → 与幂等收益的取舍，个人网盘规模可接受；如成瓶颈可退化为"分批 copy → 分批 deleteMany"（仍保持批次粒度的幂等）
- [撤销时源位置被新对象占用] → 撤销沿用 D4 的冲突策略（自动加后缀），不得覆盖
- [manifest 写入后、任何对象搬运前中断] → "继续"会重跑一遍（全量 copy，无浪费，因为对象本来就还在源位置）；"撤销"发现目标侧为空，仅删 manifest
- [`.moves/` 前缀被 gallery/回收站等递归扫描误显示] → 实现时核对 `_galleryHooks` 与 `.trash/` 的排除逻辑，为 `.moves/` 增加同等排除（参照 `workspace-hidden-entries` 的隐藏约定）
- [移动期间另一台设备并发写同路径] → 一期单用户设备规模，接受 last-writer-wins，不做锁

## Migration Plan

纯客户端新增功能，无数据迁移。发布即生效；未完成移动的 manifest 仅由新版客户端识别（旧版会忽略 `.moves/` 前缀下的对象，不产生破坏）。回滚 = 回退客户端版本，残留 manifest 不影响旧版任何流程。
