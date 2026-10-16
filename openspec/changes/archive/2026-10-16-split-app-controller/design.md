# Design

## Context

客户端子仓库有 8 个超过 800 行上限的源码文件。其中 `app_controller.dart`（4128 行）是上帝类，其余 7 个各有形态：

| 文件 | 行数 | 形态 |
|---|---|---|
| `features/workspace/presentation/workspace_page.dart` | 3498 | 页面 State（约 1545 行）+ 21 个子组件类（约 1900 行） |
| `features/gallery/presentation/gallery_viewer_page.dart` | 1781 | 页面骨架（约 180 行）+ 15 个子组件类 |
| `features/transfer/presentation/transfer_tasks_page.dart` | 1105 | 4 个头部组件 + State（约 807 行） |
| `features/gallery/presentation/gallery_page.dart` | 1030 | State（约 288 行）+ 13 个子组件类 |
| `features/workspace/infrastructure/oss_client.dart` | 1278 | 单类约 40 个方法：配置/列举/统计/媒体/传输 + `DirectorySummary` 数据类 + EXIF 解析器 |
| `features/gallery/infrastructure/photo_index_repository.dart` | 838 | manifest 读写/写入队列 + 全量扫描 + 缩略图回填 |
| `features/gallery/application/gallery_controller.dart` | 814 | 控制器主体 + `GalleryIndexHooks` 实现 |

当前客户端状态层只有一个上帝类 [client/lib/shared/state/app_controller.dart](../../../client/lib/shared/state/app_controller.dart)（4128 行），经 `AppScope`（`InheritedNotifier<AppController>`）供全部 UI 访问。gallery 模块已有独立控制器先例：`GalleryScope`（`InheritedNotifier<GalleryController>`）。

现有耦合盘点（拆分设计的约束输入）：

| 职责域 | 关键状态 | 跨域依赖 |
|---|---|---|
| 会话/认证 | `_session`、`_bootstrapped` | 被所有域读取；`logout()` 取消运行中传输、清分享与工作区状态 |
| 目录浏览/导航 | `_currentPath`、`_remoteDirectories`、`_aliasTable`、选择状态、目录统计缓存 | `DirectorySummaryService`、`AliasRepository` 内部持有 |
| 别名 | `_aliasTable` 写入 | 写后刷新浏览（`_treeRevision`）、`openAlias` 触发导航 |
| 删除/回收站 | `deleteStateListenable` | 删后修正浏览状态与统计、通知相册索引 |
| 移动 | `moveStateListenable`、`_isMoving` | 冲突对话框用 `_navigatorKey`；结束后 `_refreshAfterMove` 修正浏览 |
| 传输 | `tasksListenable`、并发/暂停监听器、keepalive、staging、持久化 | 上传完成修正目录统计；冲突对话框用 `_navigatorKey`；读会话 |
| 分享导入 | 批次状态、待上传清单 | 确认后调用 `uploadFile` 入队；失效目标目录统计 |
| 偏好 | `_themeMode`、`_autoCheckUpdates`、排序/缩略图 | 各自读写 `SharedPreferences` |
| 更新/门禁 | `_updateService`、`_forcedUpgradeResult`、`_disableStartupUpdateCheck` | `main.dart` 启动调用 `checkForcedUpgradeGate`；`app.dart` 外壳按 `forcedUpgradeActive` 整树替换；强制升级页读 `updateService` |

UI 消费面：12 个文件约 62 处 `AppScope.of/read` 调用点（其中 workspace_page 32 处、forced_upgrade_page 3 处）；`gallery_controller.dart` 与 `file_repository.dart` 直接持有 `AppController` 引用，`main.dart` 与 `app.dart` 外壳直接读门禁状态。

## Goals / Non-Goals

**Goals:**
- 每个控制器文件 ≤ 800 行，职责单一、边界清晰，为后续 AI 辅助开发提供结构性约束
- 功能行为、持久化格式、测试覆盖完全不变
- 每个重构提交可编译、全量测试通过

**Non-Goals:**
- 不引入状态管理框架（保持 `ChangeNotifier` + `InheritedNotifier`）
- 不改动 gallery 模块业务逻辑（仅结构性切分与依赖适配）
- 不拆 `server/package-lock.json`（生成物）、`client/.github/workflows/release.yml`（CI 配置）、`docs/Flutter架构设计.md`（文档）
- 不改变 UI 交互与视觉

## Decisions

### D1. 控制器拆分与文件归属

按职责域拆为 8 个控制器 + 1 个纯 Dart 队列类，遵循既有 feature 分层（application 层放控制器）：

| 新文件 | 吸收的现有方法（按 app_controller.dart 行号） | 预估行数 |
|---|---|---|
| `features/auth/application/session_controller.dart` | 会话域（604–784 及 `_rememberCredentials`） | ~200 |
| `features/workspace/application/workspace_controller.dart` | 浏览/导航/排序缩略图偏好/目录摘要（785–1460）、选择（1452–1640）、创建重命名（1641–1686） | ~700 |
| `features/workspace/application/alias_controller.dart` | 别名域（1106–1263） | ~200 |
| `features/workspace/application/recycle_bin_controller.dart` | 删除与回收站（1687–2095 及回收站导航状态 461–470） | ~400 |
| `features/workspace/application/move_controller.dart` | 移动域（2096–2732） | ~640 |
| `features/transfer/application/transfer_controller.dart` | 上传/下载入队与冲突对话框（2733–3475） | ~650 |
| `features/transfer/application/transfer_queue.dart` | 队列调度/keepalive/历史与断点持久化（3627–4048 及 4088–4128 辅助类），非 `ChangeNotifier` | ~650 |
| `features/share_import/application/share_import_controller.dart` | 分享导入（3476–3612） | ~150 |
| `features/settings/application/settings_controller.dart` | 主题与自动检查更新（547–568、641–655、1363–1381）、强制升级门禁与 `updateService` 持有（569–598、构造参数） | ~160 |

拆分后删除 `shared/state/app_controller.dart`。领域模型随控制器迁往对应 feature 的 domain 层：`LoginResult`→auth、`BatchDeletePreview/Summary`/`DeleteProgress`/`MoveProgress`/`MoveSummary`/`MoveConflictResolution`/`DirectorySizeState`→workspace、`BatchDownloadEnqueueResult`/`UploadConflictResolution`→transfer、`ShareImportItem`/`ShareImportCompleteBatch`/`ShareImportBatchState`→share_import；`GalleryIndexHooks` 是跨 feature 集成契约，迁至 `shared/gallery_index_hooks.dart`。

**备选**：全塞进 workspace feature、或按「状态/用例」而非「域」切分 —— 放弃，与既有 feature 分层文档不符。

### D2. AppScope 改为聚合入口 AppServices

`AppServices` 持有全部控制器引用，实现 `ChangeNotifier` 并订阅每个子控制器转发通知（子控制器变更 → AppServices 转发 → `AppScope` 依赖重建，与现状行为一致）；细粒度刷新仍走各控制器内 `ValueNotifier`（`tasksListenable`、`selectedItemListenable` 等原样保留）。`AppScope.of(context)` 返回 `AppServices`，调用点改为 `AppScope.of(context).workspace.xxx`。

**备选**：为每个控制器建独立 `InheritedNotifier` 嵌套（GalleryScope 式）—— 放弃，8 层嵌套的声明与迁移成本更高，且丢失「单入口」的心智模型；细粒度重建由 ValueNotifier 层保证，聚合转发不带来可感知重建开销。

### D3. 跨域依赖：构造注入 + 装配层回调

- `OssClient` 在 `AppBootstrap` 创建一次注入所有控制器；`onCredentialExpired` 指向 `SessionController.handleCredentialExpired`
- 控制器间直接持具体类型引用（与 gallery_controller 持 AppController 的现状一致，不引入接口抽象）：`WorkspaceController`/`RecycleBinController`/`MoveController`/`TransferController` 持 `SessionController` 读会话与权限；`RecycleBinController`/`MoveController`/`TransferController` 持 `WorkspaceController` 做树版本、目录统计与选择状态修正；`ShareImportController` 持 `TransferController` 与 `WorkspaceController`
- 会话生命周期跨域清理走 `SessionController` 上的两个装配钩子：`beforeSessionCleared`（传输取消、冲突批次决策清空）与 `onSessionChanged`（工作区路径/选择/统计重置、分享清空），由 `AppBootstrap` 装配
- `navigatorKey` 仅注入 `MoveController` 与 `TransferController`（冲突对话框）
- `GalleryIndexHooks` 注入 `WorkspaceController`（上传完成增量更新）、`RecycleBinController`（删除清理/还原恢复）、`MoveController`（搬运后双向通知）
- `UpdateService` 实例由 `SettingsController` 创建并持有（settings 页与强制升级页经 `AppScope` 读同一实例）；强制升级门禁状态（`forcedUpgradeActive`/`forcedUpgradeResult`）与 `checkForcedUpgradeGate` 归 `SettingsController`，`main.dart` 启动检查与 `app.dart` 外壳改经 `services.settings` 访问
- 纯路径工具（`rootPrefix` 常量、`normalizeDirPath`、`parentPathOf`）下沉为 `shared/path_utils.dart` 顶层函数，消除控制器间工具方法互调

**备选**：事件总线/流式事件 —— 放弃，一期规模下回调与直接引用更可读、可测。

### D4. 增量迁移策略（门面退化）

1. 按依赖序逐个抽出控制器（Session → Transfer/TransferQueue → ShareImport → Move → RecycleBin → Alias → Workspace → Settings）；每个控制器落地后，`AppController` 的对应公开方法改为委托（门面），**UI 与既有测试零改动**，每个提交全量测试通过
2. 各控制器测试随提交从 `app_controller_test.dart` 迁出为独立测试文件（改测新控制器），覆盖不减少
3. 收尾提交：`AppServices` 上线、`AppScope` 切换、全部 UI 调用点迁移、删除门面
4. 客户端每步独立提交（约 10 个 commit），完成后主仓库更新 submodule 指针与 `docs/Flutter架构设计.md`

**备选**：大爆炸一次性重写 —— 放弃，中间态不可编译、无法分步验证，与「每提交可验证」的协作约定冲突。

### D5. 组装与启动顺序

`AppBootstrap.initialize` 改为：创建 `OssClient` → 创建各控制器并注入依赖（`UpdateService` 注入 `SettingsController`）→ 装配会话钩子与 `GalleryIndexHooks` → `AppServices.bootstrap()`（各控制器恢复偏好与传输历史 → `SessionController.bootstrap()` 恢复会话 → 工作区据会话重置）。gallery 控制器改持 `SessionController`/`TransferController`/`RecycleBinController` + `OssClient`。`main.dart` 保持启动顺序不变：`AppBootstrap.initialize` 完成后经 `services.settings.checkForcedUpgradeGate()` 发起静默门禁检查。

### D6. 页面文件：子组件抽取到 `presentation/widgets/`

4 个页面文件的共性是多子组件堆叠。子组件类彼此独立、与 State 的耦合只有构造函数参数，逐个搬到 `presentation/widgets/` 独立文件（命名沿用现有类名，私有类保持私有）。公共组件（`WorkspaceDesktopBody`、`WorkspaceMobileHeader` 等已公开的类）保持公开；纯页面私有组件以 `_` 开头搬入独立文件后仅本页面可见性不变（Dart 库级私有，独立文件后无法跨文件引用私有符号——因此跨文件使用的组件需去下划线公开，仅在 widgets 目录内小范围公开，不扩大对外 API 面）。

**备选**：全部保留在页面文件内用 part 切分 —— 放弃，独立组件文件比 part 更利于复用与单独测试。

### D7. 单类超限：`part` 文件按关注点切分

以下三类场景无法用「抽类」解决（抽类会改变 API 或制造人为抽象），采用 Dart `part` 文件保持同一库内私有访问：

- `_WorkspacePageState`（约 1545 行）：切为「生命周期/导航/打开选择」「操作处理器（新建/重命名/删除/别名/下载/移动/上传弹窗）」「build 构建与摘要辅助」三个 part
- `_TransferTasksPageState`：build 辅助方法（`_buildBody`/`_buildMobileTaskCard`/详情格式化）切为一个 part
- `OssClient`：公开 API 被全仓库调用，抽类会牵动所有调用点；按「目录列举与统计」「媒体处理（缩略图/预览/EXIF）」「传输（上传/下载/流式/预签名）」切三个 part，主文件保留配置与会话核心
- `GalleryController`：`GalleryIndexHooks` 实现方法切一个 part

**备选**：抽独立协作类（如 `OssListingClient`）—— 放弃，调用点迁移面过大，与本变更「零行为变化」原则冲突；part 文件提供物理边界，后续如需真正独立类可在 part 基础上演进。

### D8. PhotoIndexRepository 抽 `PhotoScanner` 协作类

扫描与回填是仓库内聚性最低的部分（不触碰 manifest 状态，仅消费 OSS 与磁盘缓存），抽为 `photo_scanner.dart` 的 `PhotoScanner`（`fullScan`/`_scanEntry`/`_scanEntryOnce`/`backfill*`/`_resizeOriginalThumbnail`，构造注入 `OssClient` 与缩略图上传回调），仓库保留 manifest 读写、写入队列、`addUploadedMedia` 与删除/还原增量。**备选**：part 切分 —— 可用但扫描逻辑本就有独立协作对象形态，抽类更彻底且可单独测试。

## Risks / Trade-offs

- [拆分过程引入行为差异] → 每提交跑全量 `flutter test` 与 `flutter analyze`；测试保持原断言不变（仅换被测对象），关键路径（传输并发、冲突对话框、移动幂等）逐提交回归
- [控制器间循环引用（Workspace ↔ Alias 等）] → 双向持引用是刻意的务实选择（D3），初始化顺序固定：先 Session，再 Workspace，后其余；避免在构造函数中互相调用方法，仅存引用
- [AppServices 聚合转发导致整树重建] → 现状 `AppController` 本身即是整树 `notifyListeners` 源头，转发不劣化现状；细粒度路径保持 ValueNotifier 不变
- [子组件搬迁改变私有可见性] → 跨文件组件去下划线小范围公开，仅限 `presentation/widgets/` 内部互引，不对外导出；搬移过程逐页 `flutter analyze` 校验
- [part 文件切分后单类仍在逻辑上庞大] → part 只解决物理文件体积与堆积约束；真正的职责收敛由 D1 控制器拆分承担，页面 State 的进一步瘦身（如抽 WorkspacePageController）不在本次范围
- [门面阶段文件仍大、沟通成本] → 门面仅存活于过渡期，收尾提交即删除；每个提交的 diff 聚焦单一控制器，评审负担可控
- [测试迁移可能掩盖假设] → 测试文件按控制器整体搬迁，只改被测对象构造方式，不断言与场景文本

## Migration Plan

1. 客户端逐控制器提交（见 tasks.md），每提交验证 `flutter analyze` + `flutter test`
2. 控制器重构完成后，按页面/基础设施逐个拆分其余超限文件，每个文件一个提交
3. 收尾提交后全量测试 + `flutter run -d macos --dart-define-from-file=../secrets/client/local.json` 手工冒烟（登录、浏览、上传下载、移动、回收站、分享导入、冲突对话框、相册浏览、应用外壳与门禁放行）
4. 更新 `docs/Flutter架构设计.md`（控制器职责表、目录结构、widgets 目录与 part 文件约定、装配描述）
5. 主仓库提交 submodule 指针更新与文档变更
6. 回滚策略：每提交独立可回滚；门面存在期间任何异常可停在当前提交，不影响既有功能

## Open Questions

无。
