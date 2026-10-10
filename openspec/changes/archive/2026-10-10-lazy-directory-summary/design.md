# 设计：目录浏览性能优化（子目录统计懒加载 + 本地缓存）

## Context

`OssClient.list()`（`client/lib/features/workspace/infrastructure/oss_client.dart:59`）在 1 次带 `delimiter='/'` 的前缀列举后，对每个子文件夹同步调用 `_readDirectorySummary()`，完整翻页遍历其全部直属对象以计算条目数与最新更新时间。`Future.wait` 等待全部统计完成后才把列表交给 `LoadDirectoryUseCase` → `workspace_page.dart` 渲染。目录越大、子文件夹越多，首屏等待越久，且无任何缓存。

客户端已用 sqflite 做相册本地持久化（`lib/features/gallery/infrastructure/gallery_database.dart`），可复用同一模式。所有文件写操作（上传、删除、建目录、移动、回收站清理）都经由客户端执行，具备写时维护缓存的条件。

## Goals / Non-Goals

**Goals:**

- 进入任意目录的列表首屏只依赖 1 次 OSS 列举请求，不被子文件夹统计阻塞。
- 子文件夹统计异步补齐，受限并发（上限 4），单个结果即时刷新对应条目。
- 统计结果本地缓存，二次进入目录立即呈现，后台校准。
- 写操作增量修正缓存，避免明显陈旧。

**Non-Goals:**

- 不改服务端接口、不引入服务端统计对象（`.meta` 汇总）。
- 不改目录选择对话框"不做内容统计"的既有行为（`file-move` 规格保持不变）。
- 不做跨设备缓存同步；缓存仅本机有效，登录/登出不迁移。
- 不为缓存做加密或复杂版本迁移——缓存内容可随时重建，损坏即清空。

## Decisions

### D1：统计从 `list()` 中拆出，独立为按文件夹的查询

`OssClient.list()` 删除 `_readDirectorySummary` 的内联调用，仅返回目录列举结果（子文件夹条目 `itemCount/updatedAt` 为空）。新增 `OssClient.directorySummary(String path)`（内部即现 `_readDirectorySummary` 逻辑，保留隐藏条目过滤），由上层按文件夹逐个调用。

- 备选：保留 `list()` 签名，内部改为"先返回再回填"的流式接口（Stream 或回调）。否决——回填语义放进基础设施层会迫使所有调用方（含目录选择对话框）适配回调模型，而现有调用方只有 workspace 页面需要回填。

### D2：新增 `DirectorySummaryService`（应用/基础设施层），负责缓存 + 受限并发 + 失效

位置：`client/lib/features/workspace/infrastructure/directory_summary_service.dart`。

- `Future<DirectorySummary?> cached(String path)`：读本地缓存，同步可得的初始值。
- `Future<void> refresh(Iterable<String> paths, void Function(String path, DirectorySummary summary) onResult)`：以信号量限并发 4，逐个调用 `OssClient.directorySummary`，每个结果先写缓存再回调；调用方在目录切换时取消订阅旧任务（用代数/generation 标记丢弃过期回调，不真正中断 OSS 请求）。
- 写时修正接口：`void noteFilesAdded(String dir, int count, DateTime at)`、`void noteFilesRemoved(String dir, int count)`、`void invalidate(String dir)`。内部对缓存行做 `itemCount ± count`、`updatedAt` 取 max，无法可靠增量时（未知数量）直接删除该行。

`FileRepository` / `AppController` 上暴露对应转发方法，workspace 页面通过 controller 访问。

- 备选：把缓存塞进 `gallery_database` 同一 DB。否决——相册库有自己的生命周期与结构，混入会让两块功能互相牵连；单独建 `directory_summary.db` 更符合现有"每域一个库"的形态。

### D3：缓存表结构最小化

表 `directory_summaries(path TEXT PRIMARY KEY, item_count INTEGER NOT NULL, updated_at INTEGER NULL, fetched_at INTEGER NOT NULL)`。`fetched_at` 仅用于诊断与将来限频，一期不做 TTL 强制过期——写时修正 + 每次进入目录后台校准已保证收敛。

### D4：workspace 页面采用"缓存先显 + 后台刷新 + 逐条回填"

`workspace_page` 加载目录时：

1. `list()` 返回后立即渲染全量条目（文件夹无统计）。
2. 对返回的子文件夹，先把 `cached()` 命中的值合入条目再渲染（或合并渲染后立即回调刷新），随后调用 `refresh(...)`，回调中用 `setState` 更新 `_visibleItems` 中对应条目。
3. 目录切换或刷新时递增 generation，回调检查 generation 丢弃过期结果，避免旧目录的统计写进新目录。

- 备选：在 controller 层维护完整响应式列表状态。否决——现有页面用 `_itemsFuture + _visibleItems` 的轻量模型，改造范围最小原则下不动状态管理结构。

### D5：写时修正挂在既有写路径的完成点

- workspace 页内上传完成、新建文件夹：`noteFilesAdded(dir, n, now)`（新建文件夹也使计数 +1）。
- 删除（含批量删除）：对每个被删条目所属目录 `noteFilesRemoved(dir, 1)`。
- 移动完成：源目录 `noteFilesRemoved(dir, n)`、目标目录 `noteFilesAdded(dir, n, now)`。
- 回收站清空、share_import 写入等不可靠计数路径：`invalidate(dir)`。

写修正后同时触发该目录的后台 `refresh`，让计数最终与 OSS 一致。相册写入走 `.gallery/` 隐藏前缀，本就不在浏览统计内，无需挂钩。

## Risks / Trade-offs

- [统计结果短暂不显示（首次进入新目录）] → 文件夹条目始终可见，仅统计为空占位；缓存命中后二次进入即有值。可接受，符合"首屏优先"取舍。
- [写时修正与 OSS 实际状态漂移（如多端并发写入）] → 每次进入目录都后台校准覆盖漂移；个人盘场景多端并发写同目录概率低。漂移窗口内计数可能偏差，属展示层非关键数据。
- [受限并发下大文件夹统计仍慢] → 单个文件夹统计本身是多页串行（受 OSS 分页限制），懒加载后不再拖累其他文件夹与首屏；无进一步优化空间，除非砍掉该展示。
- [sqflite 初始化失败] → 缓存层全部方法吞错降级（返回 null / 无操作），仅损失缓存，不损失功能。
- [目录切换竞态] → generation 标记丢弃过期回调；`refresh` 不主动取消进行中的 OSS 请求，浪费的请求量可控（每文件夹一次列举）。

## Migration Plan

纯客户端改动，无数据迁移。缓存 DB 不存在时按需创建；旧版本升级后首刷即建立缓存。回滚即恢复 `list()` 内联统计，无残留依赖。

## Open Questions

（无。并发上限取 4、缓存不做 TTL 属可调参数，实现期可按实测调整。）
