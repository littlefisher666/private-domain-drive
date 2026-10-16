# Tasks

实施全部发生在 `client/` 子仓库，每完成一组即提交一个 commit；每组结束时该组新增测试通过且既有测试全量通过。验证命令均在 `client/` 目录执行。

## 1. 公共基础：路径工具与跨域契约

- [x] 1.1 新建 `lib/shared/path_utils.dart`（`rootPrefix` 常量、`normalizeDirPath`、`parentPathOf` 顶层函数），`AppController` 的 `_normalizeDir`/`parentPath` 改为委托，验证 `flutter analyze` 与 `flutter test` 全量通过
- [x] 1.2 新建 `lib/shared/gallery_index_hooks.dart`，把 `GalleryIndexHooks` 接口与 `lib/shared/transfer_keepalive.dart` 中 AppController 引用说明一并迁出，验证 `flutter analyze` 通过且 gallery 测试不受影响

## 2. 抽取 SessionController

- [x] 2.1 新建 `lib/features/auth/domain/login_result.dart`（迁出 `LoginResult`）与 `lib/features/auth/application/session_controller.dart`：会话状态、`login/logout/changePassword/bootstrap/ensureSessionReady/handleCredentialExpired/readSavedCredentials`、`beforeSessionCleared`/`onSessionChanged` 装配钩子；`AppController` 改为门面委托并接线 `_ossClient.onCredentialExpired`，验证 `flutter analyze` + `flutter test` 全量通过
- [x] 2.2 新建 `test/session_controller_test.dart`，把 `app_controller_test.dart` 中登录失败、记住凭据、改密三个测试迁入并改为直测 `SessionController`，验证两文件测试均通过且原断言不变

## 3. 抽取 TransferController + TransferQueue

- [x] 3.1 新建 `lib/features/transfer/application/transfer_queue.dart`（非 ChangeNotifier）：任务表 `tasksListenable`、并发/暂停监听器、`_pending/_running/_canceled/_pauseRequested` 集合、队列调度（`_enqueueTransfer/_drainTransferQueue/_runTransfer/_replaceTask`）、keepalive 同步（`_syncTransferKeepalive` 及批次计数）、传输历史与 `upload_pending:v1` 持久化（`_restoreTransferHistory/_saveTransferHistory/_restoreUploadPending/_saveUploadPending` 系列）、`_TransferSpeedTracker`；`AppController` 委托 `tasks/tasksListenable/transferConcurrency/transferQueuePaused/runningTransferCount/pendingTransferCount/setTransferConcurrency`，验证 `flutter test` 全量通过（重点：传输保活 3 个用例、下载并发、历史恢复）
- [x] 3.2 新建 `lib/features/transfer/domain/transfer_enqueue.dart`（迁出 `BatchDownloadEnqueueResult`、`UploadConflictResolution`）与 `lib/features/transfer/application/transfer_controller.dart`：`uploadFile/_buildUploadClosure/冲突对话框与整批应用/downloadBytes/enqueueDownload(s)(Recursively)/retry/resume/abandon/cancel/pause/resumeAll/cancelAll/clearCompletedTasks`，持 `SessionController`/`WorkspaceController`/`TransferQueue`/`OssClient`/`navigatorKey`/`GalleryIndexHooks`/`UploadStaging`；`AppController` 相应公开方法改门面委托（`setNavigatorKey` 同时转发给 TransferController），验证 `flutter test` 全量通过（重点：上传冲突对话框 3 个 widget 用例、断点续传相关用例）
- [x] 3.3 新建 `test/transfer_controller_test.dart`，迁入传输域测试并改为直测 `TransferController`/`TransferQueue`（含保活、并发、递归下载、取消清理、冲突对话框），验证原断言不变且 `app_controller_test.dart` 剩余用例通过

## 4. 抽取 ShareImportController

- [x] 4.1 新建 `lib/features/share_import/domain/share_import_models.dart`（迁出 `ShareImportItem/ShareImportCompleteBatch/ShareImportBatchState`）与 `lib/features/share_import/application/share_import_controller.dart`：批次状态与 `prepareShareImport/beginShareImportBatch/addShareImportItem/finishShareImportBatch/addCompletedShareBatch/setShareTargetPath/confirmShareUpload`，持 `TransferController`/`WorkspaceController`/`SessionController`；`AppController` 门面委托，验证 `flutter test` 全量通过
- [x] 4.2 新建 `test/share_import_controller_test.dart`，迁入分享导入域测试（批次渐进接收、多文件同批次上传）并直测新控制器，验证原断言不变

## 5. 抽取 MoveController

- [x] 5.1 新建 `lib/features/workspace/domain/move_models.dart`（迁出 `MoveProgress/MoveSummary/MoveConflictResolution`）与 `lib/features/workspace/application/move_controller.dart`：`moveItems` 全流程、冲突对话框、`listPendingMoves/resumePendingMove/undoPendingMove` 与全部私有执行器，持 `SessionController`/`WorkspaceController`/`OssClient`/`navigatorKey`/`GalleryIndexHooks`；`AppController` 门面委托（`moveStateListenable/isMoving/moveItems/...`），验证 `flutter test` 全量通过（重点：`workspace_file_move_test.dart`）
- [x] 5.2 新建 `test/move_controller_test.dart`，把 `app_controller_test.dart` 及 `workspace_file_move_test.dart` 中直连 AppController 的移动用例迁为直测 `MoveController`（保持断言与场景不变），验证全量通过

## 6. 抽取 RecycleBinController

- [x] 6.1 新建 `lib/features/workspace/domain/delete_models.dart`（迁出 `BatchDeletePreview/BatchDeleteSummary/DeleteProgress`）与 `lib/features/workspace/application/recycle_bin_controller.dart`：`deleteItem/prepareBatchDelete/deleteBatch/_moveToRecycleBin/listRecycleBin/restoreRecycleBinEntry/purgeRecycleBinEntry/retryBatchDelete` 及回收站导航状态（`recycleBinPath/setRecycleBinPath/recycleBinUpPath`），持 `SessionController`/`WorkspaceController`/`OssClient`/`GalleryIndexHooks`；`AppController` 门面委托，验证 `flutter test` 全量通过（重点：`recycle_bin_per_item_test.dart`）
- [x] 6.2 新建 `test/recycle_bin_controller_test.dart`，迁入删除与回收站域测试并直测新控制器，验证原断言不变

## 7. 抽取 AliasController

- [x] 7.1 新建 `lib/features/workspace/application/alias_controller.dart`：`openAlias/createAlias/deleteAlias/renameAlias/_validateAliasName`，持 `SessionController`/`WorkspaceController`/`AliasRepository`/`OssClient`，`openAlias` 经 `WorkspaceController.enterAliasTarget` 触发导航；`AppController` 门面委托，验证 `flutter test` 全量通过（重点：`workspace_alias_test.dart`）

## 8. 抽取 WorkspaceController 与 SettingsController

- [x] 8.1 新建 `lib/features/workspace/application/workspace_controller.dart`：目录浏览/导航/选择（含目录大小与 EXIF takenAt）/创建重命名/排序缩略图偏好/目录摘要服务代理/`sidebarDirectories`，持 `SessionController`/`OssClient`/`DirectorySummaryService`/`GalleryIndexHooks`；`AppController` 剩余公开方法全部改门面委托，验证 `flutter test` 全量通过（重点：目录浏览、多选、缩略图偏好用例）（提前实施：3.2 的 TransferController 依赖 WorkspaceController，故在组 3 之前先完成本任务）
- [x] 8.2 新建 `lib/features/settings/application/settings_controller.dart`：`themeMode/autoCheckUpdates/setThemeMode/setAutoCheckUpdates`、强制升级门禁（`forcedUpgradeActive/forcedUpgradeResult/checkForcedUpgradeGate` 及 `updateService` 实例持有，构造参数 `updateService/disableStartupUpdateCheck` 接入）及偏好恢复；`AppController` 门面委托，验证主题/自动检查/强制升级相关测试通过

## 9. AppServices 聚合、AppScope 切换与门面拆除

- [x] 9.1 新建 `lib/shared/state/app_services.dart`：持有全部控制器、订阅并转发通知、统一 `bootstrap()`（偏好/传输恢复 → 会话恢复 → 工作区重置）；重写 `lib/app/bootstrap/app_bootstrap.dart` 装配全部依赖与钩子（含 `UpdateService` 注入 SettingsController），验证 `flutter analyze` 通过
- [x] 9.2 `lib/shared/state/app_scope.dart` 改为 `InheritedNotifier<AppServices>`；迁移 12 个 UI 文件的全部调用点（workspace_page 32 处、recycle_bin_page、transfer_tasks_page、gallery_viewer_page、preview_page、settings_page、forced_upgrade_page 3 处、login/splash/change_password、share_target_dialog、home_shell、app.dart、main.dart、file_repository、gallery_controller 改为持新控制器）；删除 `app_controller.dart` 门面，验证 `flutter analyze` + `flutter test` 全量通过
- [ ] 9.3 拆分剩余 `app_controller_test.dart`（1303 行，工作区浏览/选择/回收站/别名相关用例）为 `test/workspace_controller_test.dart`、`test/alias_controller_test.dart`、`test/settings_controller_test.dart` 并直测新控制器；`forced_upgrade_widget_test.dart` 改经 AppServices 装配（门禁断言不变），删除旧测试文件，验证全量测试通过且覆盖不减少

## 10. 拆分 workspace_page.dart

- [ ] 10.1 新建 `lib/features/workspace/presentation/widgets/`，把 21 个子组件类逐个搬入独立文件（`_BatchSelectionBar`、`WorkspaceDesktopBody`、`_CupertinoSegmented`、`_SegButton`、`_ThumbnailSizeSegmented`、`WorkspaceMobileHeader`、`_EmptyState`、`WorkspaceListView`、`WorkspaceGridView`、`_MobileUniformGrid`、`_DesktopMarqueeSelection`、`_SelectionRectanglePainter`、`_DetailPanel`、`_HoverCheckbox`、`_InlineRenameField`、`_MoveProgressBanner`、`_DeleteProgressBanner` 等，跨文件使用的去下划线小范围公开），验证 `flutter analyze` + `flutter test` 全量通过
- [ ] 10.2 `_WorkspacePageState` 用 `part` 文件按关注点切分：主文件保留生命周期/导航/打开选择（约 600 行），`workspace_page_actions.dart` 放操作处理器（新建/重命名/删除/别名/下载/移动/上传弹窗），`workspace_page_build.dart` 放 build 构建与摘要辅助，验证 `flutter analyze` + `flutter test` 全量通过且 `workspace_page.dart` 主文件 ≤ 800 行

## 11. 拆分 gallery_viewer_page.dart

- [ ] 11.1 把 15 个子组件类（`_MobileViewer`、`_MobileDetailSheet`、`_DesktopViewer`、`_OverlayAction`、`_DownloadOverlayAction`、`_InfoPanel`、`_ViewerImage`、`_VideoPlayerView`、`_MobileVideoControls`、`_DownloadButton` 等）搬入 `lib/features/gallery/presentation/widgets/` 独立文件，`FileSizeFormatterLite` 迁至共享工具；主文件保留 `GalleryViewerArguments`/`GalleryViewerPage`/`_GalleryViewerPageState`（≤ 300 行），验证 `flutter analyze` + `flutter test` 全量通过（重点：`preview_page_test.dart` 与视频播放相关用例）

## 12. 拆分 transfer_tasks_page.dart

- [ ] 12.1 把 `_TransferHeaderActions`、`_TransferSelectionActions`、`_TransferTypeFilter` 搬入 `lib/features/transfer/presentation/widgets/`；`_TransferTasksPageState` 的 build 辅助（`_buildBody`/`_buildMobileTaskCard`/详情与格式化）用 `part` 文件 `transfer_tasks_page_build.dart` 切出，主文件 ≤ 600 行，验证 `flutter analyze` + `flutter test` 全量通过（重点：`transfer_tasks_page_test.dart`）

## 13. 拆分 gallery_page.dart

- [ ] 13.1 把 13 个子组件类（`_DesktopShortcuts`、`_GroupHeader`、`_PhotoCell`、`_ThumbnailView`、`_CloudBadge`、`_MobileAppBar`、`_MobileBatchBar`、`_BatchAction`、`_DesktopSelectionBar`、`_DesktopStatusLine`、`_ScanProgressView`、`_ErrorView` 等）搬入 `lib/features/gallery/presentation/widgets/`，主文件保留 `GalleryPage` 与 `_GalleryPageState`（≤ 400 行），验证 `flutter analyze` + `flutter test` 全量通过

## 14. 切分 oss_client.dart

- [ ] 14.1 用 `part` 文件按职责切分（公开 API 不变、零调用点改动）：主文件保留配置/凭证/会话核心，`oss_client_listing.dart` 放目录列举与统计（list/directorySummary/listEntryNames/listAllObjectKeys/forEachObjectKeyPage/calculateDirectorySize/listPrefixes/objectExists/listAllObjects），`oss_client_media.dart` 放媒体处理（缩略图/预览/视频截帧/EXIF 与解析器），`oss_client_transfer.dart` 放传输（上传/下载/流式/预签名/copy/deleteMany/cancelTransfer）；`DirectorySummary` 数据类迁至 `lib/features/workspace/domain/directory_summary.dart`，验证 `flutter analyze` + `flutter test` 全量通过且每个 part ≤ 800 行

## 15. photo_index_repository.dart 抽 PhotoScanner

- [ ] 15.1 新建 `lib/features/gallery/infrastructure/photo_scanner.dart`：`PhotoScanner` 承载 `fullScan`/`_scanEntry`/`_scanEntryOnce`/`backfillMissingThumbnails`/`_backfillEntryWithRetry`/`_backfillEntry`/`_resizeOriginalThumbnail`（构造注入 `OssClient` 与缩略图上传回调）；`PhotoIndexRepository` 保留 manifest 读写、写入队列、`addUploadedMedia`、`removeDeletedMedia`、`restoreMedia`、`isMediaKey`（≤ 500 行），验证 `flutter analyze` + `flutter test` 全量通过（重点：gallery 扫描与回填相关测试）

## 16. 切分 gallery_controller.dart

- [ ] 16.1 `GalleryIndexHooks` 实现方法（`prepareVideoThumbnail`/`prepareImageThumbnail`/`onMediaUploaded`/`onObjectsDeleted`/`onObjectsRestored`）用 `part` 文件 `gallery_controller_hooks.dart` 切出，主文件 ≤ 750 行，验证 `flutter analyze` + `flutter test` 全量通过（重点：gallery 增量更新相关测试）

## 17. 集成验证与文档

- [ ] 17.1 client 仓库全量 `flutter analyze`（0 issue）与 `flutter test` 通过，并用 `--dart-define-from-file=../secrets/client/local.json` 启动 macOS 冒烟：登录、浏览、上传下载、移动、回收站、分享导入、冲突对话框、相册浏览、应用外壳与门禁放行（`DISABLE_STARTUP_UPDATE_CHECK` 注入下门禁应静默跳过）各走一遍
- [ ] 17.2 更新 `docs/Flutter架构设计.md`：控制器职责表、目录结构（application 层控制器归属、`presentation/widgets/` 与 part 文件约定）、AppServices 装配与 AppScope 访问方式描述，验证文档与最终代码结构一致
- [ ] 17.3 主仓库更新 client submodule 指针并提交文档变更，验证 `git submodule status` 指向新 commit

## Workflow follow-up

- 评审通过后归档本 change（`openspec archive`），因 `skip_specs: true` 无规格同步
- `server/package-lock.json`、`client/.github/workflows/release.yml`、`docs/Flutter架构设计.md` 不拆分（生成物/CI 配置/文档），如需调整另行提案
