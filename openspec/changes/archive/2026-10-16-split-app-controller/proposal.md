# Proposal

## Why

客户端子仓库存在 8 个超过 800 行上限的源码文件：`app_controller.dart`（4128 行）与 `workspace_page.dart`（3498 行）尤为严重，其余为 `gallery_viewer_page.dart`（1781）、`oss_client.dart`（1278）、`transfer_tasks_page.dart`（1105）、`gallery_page.dart`（1030）、`photo_index_repository.dart`（838）、`gallery_controller.dart`（814）。单一文件/单一类同时承担过多职责（上帝控制器、一页堆全部子组件、一客户端全量 OSS 交互），持续积累会进一步抬高理解、修改与测试成本，且对 AI 辅助开发缺乏结构性约束，容易持续向这些文件堆叠代码。需要在功能行为完全不变的前提下，按职责域做深度拆分，把「单文件体积」与「单类职责」问题一并解决。

## What Changes

### 一、AppController 拆分为独立控制器（核心重构）

把 `app_controller.dart` 拆为一组职责单一的 `ChangeNotifier` 控制器，每个控制器文件控制在 800 行以内：

- `SessionController`：登录/登出/bootstrap 会话恢复/修改密码/凭证失效处理（约 200 行）
- `WorkspaceController`：目录浏览与导航、条目选择（单选/多选/框选）、创建/重命名、排序/缩略图偏好、目录统计摘要（约 700 行）
- `AliasController`：目录别名创建/删除/重命名/校验/进入（约 200 行）
- `RecycleBinController`：删除/批量删除/回收站列表/还原/清空（约 400 行）
- `MoveController`：移动计划执行/冲突处置/挂起移动继续与撤销（约 640 行）
- `TransferController` + `TransferQueue`：上传下载入队/冲突对话框/任务调度/keepalive/持久化（控制器约 650 行，队列约 650 行）
- `ShareImportController`：分享导入批次状态与确认上传（约 150 行）
- `SettingsController`：主题模式、启动自动检查更新偏好、强制升级门禁检查与结果状态（`updateService` 实例持有）（约 160 行）

新建 `AppServices` 聚合对象持有全部控制器并转发通知；`AppScope` 改为 `InheritedNotifier<AppServices>`，UI 经 `AppScope.of(context)` 按 `services.workspace.xxx` 形式访问（现有约 62 处 AppScope 调用点、12 个文件迁移，另有 `main.dart`/`app.dart` 等直接引用一并迁移）。跨控制器依赖改为显式注入（`OssClient` 单例共享、`SessionController` 引用、`GalleryIndexHooks` 注入、`navigatorKey` 仅注入传输与移动控制器）。纯路径工具下沉为共享顶层函数。`app_controller_test.dart`（1303 行）按控制器拆为多个测试文件，覆盖不变。

### 二、页面文件：子组件抽取

- `workspace_page.dart`（3498）：21 个子组件类（`WorkspaceDesktopBody`、`WorkspaceListView`、`WorkspaceGridView`、`_DetailPanel`、`_InlineRenameField`、进度横幅等约 1900 行）抽取到 `presentation/widgets/` 独立文件；`_WorkspacePageState`（约 1545 行）按关注点用 `part` 文件切分（生命周期与导航 / 操作处理器 / build 构建），主文件降至约 600 行
- `gallery_viewer_page.dart`（1781）：15 个子组件类（`_MobileViewer`、`_DesktopViewer`、`_InfoPanel`、`_ViewerImage`、`_VideoPlayerView` 等约 1600 行）抽取到 `presentation/widgets/`，主文件保留页面骨架降至约 200 行
- `transfer_tasks_page.dart`（1105）：4 个头部/筛选组件抽取到 `presentation/widgets/`；`_TransferTasksPageState` 的 build 辅助方法用 `part` 文件切出，主文件降至约 550 行
- `gallery_page.dart`（1030）：13 个子组件类（`_PhotoCell`、`_ThumbnailView`、批次/选择栏等约 680 行）抽取到 `presentation/widgets/`，主文件保留 `GalleryPage` 与 `_GalleryPageState`（约 350 行）

### 三、基础设施与应用层：按职责切分

- `oss_client.dart`（1278）：保持类与公开 API 完全不变，用 `part` 文件按职责切为目录列举与统计、媒体处理（缩略图/预览/EXIF）、传输（上传/下载/流式/预签名）三部分，主文件保留配置与会话核心（约 450 行）；`DirectorySummary` 数据类迁至 workspace domain
- `photo_index_repository.dart`（838）：把全量扫描与缩略图回填逻辑（`fullScan`/`_scanEntry`/`backfill*` 系列约 390 行）抽为独立 `PhotoScanner` 协作类，仓库本体保留 manifest 读写、写入队列与增量更新（约 450 行）
- `gallery_controller.dart`（814）：`GalleryIndexHooks` 实现方法（约 100 行）用 `part` 文件切出，主文件降至约 720 行

**BREAKING**：无。所有对外行为、接口契约、持久化格式、UI 交互保持不变；仅 Dart 类组织与文件布局变化（纯内部重构）。

### 明确排除

- `server/package-lock.json`（878，生成物）、`client/.github/workflows/release.yml`（825，CI 配置）、`docs/Flutter架构设计.md`（848，文档）不拆分——文档因内容同步更新，但不做文件切分

## Capabilities

### New Capabilities

无。本变更不引入任何新功能能力。

### Modified Capabilities

无。本变更不改变任何既有能力的规格行为（纯重构，`skip_specs: true`）。

## Impact

- 客户端子仓库 `client/`：
  - 新增控制器文件（`features/*/application/` 与 `shared/state/`），删除 `shared/state/app_controller.dart` 旧类（`AppScope`/`AppServices` 保留于 `shared/state/`）
  - 迁移调用点：`app.dart`、`app_bootstrap.dart`、`main.dart`（启动门禁检查）、`workspace_page.dart`（32 处）、`recycle_bin_page.dart`、`transfer_tasks_page.dart`、`gallery_viewer_page.dart`、`preview_page.dart`、`settings_page.dart`、`forced_upgrade_page.dart`（3 处）、`login_page.dart`、`splash_page.dart`、`change_password_page.dart`、`share_target_dialog.dart`、`home_shell.dart`、`file_repository.dart`、`gallery_controller.dart`
  - 4 个页面文件新增 `presentation/widgets/` 子组件文件与 `part` 文件；`oss_client.dart` 新增 3 个 `part` 文件；`photo_index_repository.dart` 新增 `PhotoScanner`；`gallery_controller.dart` 新增 1 个 `part` 文件
  - 测试拆分与迁移（`app_controller_test.dart` 及 13 个引用 `AppController` 的测试文件，含强制升级门禁的 `forced_upgrade_widget_test.dart`）
- 主仓库 `docs/Flutter架构设计.md`：控制器职责、目录结构、`presentation/widgets/` 与 part 文件约定、装配方式描述更新
- 主仓库 submodule 指针：client 提交完成后更新
- 不影响：服务端子仓库、OSS 交互协议、持久化数据格式、FC 接口契约
