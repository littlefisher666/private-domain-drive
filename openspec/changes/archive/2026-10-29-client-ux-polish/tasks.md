# Tasks

## 1. 图片预览与相册缩放

- [x] 1.1 在工作区图片预览中接入 `InteractiveViewer` 与 `TransformationController`，实现 1x–4x 捏合、双击切换比例、放大后拖动平移与切图重置；验证：新增 `client/test/preview_page_zoom_test.dart` 覆盖缩放状态切换，`flutter test test/preview_page_test.dart test/preview_page_zoom_test.dart` 通过
- [x] 1.2 在相册移动端查看器接入同样的缩放能力，并让水平/垂直切换手势仅在 1x 时生效、视频条目不应用缩放；验证：新增 `client/test/gallery_viewer_zoom_test.dart` 覆盖放大后不切图与切图重置，`flutter test test/gallery_viewer_zoom_test.dart` 通过
- [x] 1.3 更新 `docs/技术文档.md` 中图片预览与相册查看器的交互说明，验证：文档描述与双端实际手势一致（人工复核）

## 2. 回收站批量操作

- [x] 2.1 在 `RecycleBinPage` 根层实现多选：桌面 ⌘/Ctrl 点选与框选、移动端长按进入多选、全选与退出多选，新增轻量批量操作条；验证：新增 `client/test/recycle_bin_batch_test.dart` 覆盖长按多选、全选与条目内部禁用多选，`flutter test test/recycle_bin_batch_test.dart` 通过
- [x] 2.2 实现批量恢复：串行调用既有恢复逻辑、逐条沿用冲突改名、展示完成进度并汇总成功/失败数量，失败条目保留；验证：扩展 `client/test/recycle_bin_controller_test.dart` 覆盖多条目部分失败与冲突恢复，`flutter test test/recycle_bin_controller_test.dart test/recycle_bin_batch_test.dart` 通过
- [x] 2.3 实现批量立即删除与「清空回收站」，统一二次确认（含数量与不可恢复）、空回收站禁用入口、失败条目保留；验证：`client/test/recycle_bin_batch_test.dart` 覆盖确认取消、清空与部分失败，人工在 macOS/Android 各执行一次批量删除
- [x] 2.4 更新 `docs/技术文档.md` 回收站章节，补充多选、批量恢复、清空与失败处理说明，验证：文档与 `openspec/specs/recycle-bin/spec.md` 新增要求一致

## 3. 错误提示去技术化

- [x] 3.1 新增用户文案解析函数与 `AppFeedback.showError`，对 `AppError` 取 `message`、`StateError` 取 `message`、未知异常使用通用文案，并始终记录原始异常与堆栈；验证：新增 `client/test/app_feedback_test.dart` 覆盖三类异常，`flutter test test/app_feedback_test.dart` 通过
- [x] 3.2 替换表现层中所有直接展示 `error.toString()` 的位置（文件操作、分享准备、回收站等），回收站加载失败改为友好文案 + 重试按钮；验证：`grep -rn "error.toString()" client/lib` 无表现层残留，`flutter analyze` 与 `flutter test` 通过
- [x] 3.3 更新 `docs/技术文档.md` 错误处理说明，明确用户文案与调试日志的边界，验证：文档与 `openspec/changes/client-ux-polish/specs/user-feedback/spec.md` 一致

## 4. 设置页缓存管理与退出确认

- [x] 4.1 为 `DiskImageCache`、`DiskDocumentCache`、`ShareCacheStore`、`OriginalCacheStore` 增加容量统计与清理方法（同时清空内存索引），新增 `CacheManager` 汇总四类缓存；验证：新增 `client/test/cache_manager_test.dart` 使用临时目录覆盖统计与清理，`flutter test test/cache_manager_test.dart` 通过
- [x] 4.2 设置页新增缓存占用展示与「清理缓存」入口（计算中状态、二次确认、清理后刷新并提示释放空间），并为「退出登录」增加二次确认；验证：新增 `client/test/settings_page_test.dart` 覆盖取消清理、确认清理与取消退出，`flutter test test/settings_page_test.dart` 通过
- [x] 4.3 更新 `docs/技术文档.md` 设置页说明，列出缓存范围与不清理的数据，验证：文档与 `specs/app-settings/spec.md` 一致

## 5. 文件页筛选、下拉刷新与快捷键

- [x] 5.1 实现当前目录名称筛选（桌面工具栏、移动端页头入口），列表/网格/全选/批量操作统一使用筛选结果，筛选变化时裁剪选择集，切换目录清空筛选；验证：新增 `client/test/workspace_filter_test.dart` 覆盖过滤、全选仅选可见项、无匹配空态与切目录清空，`flutter test test/workspace_filter_test.dart` 通过
- [x] 5.2 为移动端文件页与回收站列表接入 `RefreshIndicator` 与 `AlwaysScrollableScrollPhysics`，刷新失败保留旧列表并走统一错误提示；验证：扩展 `client/test/workspace_filter_test.dart` 或新增 widget 测试模拟下拉调用重载，人工在 Android 上下拉刷新成功与断网失败各一次
- [x] 5.3 补齐桌面快捷键 Space 预览、Enter 重命名、Delete/⌘⌫ 移入回收站、⌘R 刷新，复用既有权限校验与确认流程，并确保输入框聚焦时不触发；验证：新增 `client/test/workspace_shortcuts_test.dart` 覆盖四个快捷键与输入态隔离，人工在 macOS 验证
- [x] 5.4 更新 `docs/技术文档.md` 文件页交互说明，补充筛选范围、下拉刷新与快捷键表，验证：文档与 `specs/workspace-browsing/spec.md` 一致

## 6. 下载目录记忆

- [x] 6.1 新增 `DownloadDirectoryStore`，`selectDownloadDirectory()` 支持传入初始目录，单文件与批量下载确认目录后写入记忆、取消不写入；验证：新增 `client/test/download_directory_test.dart` 覆盖首次默认、记忆复用与取消不覆盖，`flutter test test/download_directory_test.dart` 通过
- [x] 6.2 扩展 Android 与 macOS 原生目录选择通道：接收记忆的 URI/路径作为初始位置，失效时回退系统下载目录；验证：`flutter analyze` 通过，Android 选择自定义目录后再次下载定位到该目录、删除目录后回退默认，macOS 同样验证
- [x] 6.3 更新 `docs/技术文档.md` 下载流程说明，补充目录记忆与回退规则，验证：文档与 `specs/download-directory/spec.md` 一致

## 7. 传输中心体验补齐

- [x] 7.1 把并发数选择弹窗抽为双端共享入口，移动端更多菜单新增「传输并发数」，读写同一配置；验证：扩展 `client/test/transfer_tasks_page_test.dart` 覆盖移动端入口与设置生效，人工在 Android 修改并发数
- [x] 7.2 传输中心空态增加「去文件页」入口与说明文案，桌面/移动由 `HomeShell` 注入跳转回调，类型筛选空态保持类型文案；验证：`client/test/transfer_tasks_page_test.dart` 覆盖无任务空态与点击跳转回调，`flutter test test/transfer_tasks_page_test.dart` 通过
- [x] 7.3 「清除已结束任务」增加二次确认与数量说明，入口仅在存在已结束任务时可用；验证：`client/test/transfer_tasks_page_test.dart` 覆盖确认、取消与无任务禁用，人工双端执行一次清除
- [x] 7.4 更新 `docs/技术文档.md` 传输中心说明，补充并发入口、空态与清除确认，验证：文档与 `specs/transfer-queue-management/spec.md`、`specs/transfer-task-history/spec.md` 一致

## 8. 集成回归

- [x] 8.1 运行 `cd client && flutter analyze` 与 `flutter test`，确认全量通过且无新增告警
- [x] 8.2 macOS 注入配置启动（`flutter run -d macos --dart-define-from-file=../secrets/client/local.json`），回归图片缩放、筛选、快捷键、回收站批量、缓存清理、退出确认、下载目录记忆与传输中心空态/清除确认
- [x] 8.3 Android 注入配置启动（`flutter run -d android --dart-define-from-file=../secrets/client/local.json`），回归下拉刷新、长按多选、查看器缩放、并发设置、下载目录记忆与空态跳转
- [x] 8.4 逐项核对 `openspec/changes/client-ux-polish/specs/**` 的 Scenario 均有对应实现或测试，确认无遗漏后执行 `openspec validate client-ux-polish --strict`

## Workflow follow-up

- 评审通过后归档变更，并同步 `openspec/specs/` 主规格。
- 归档后确认新增能力（`user-feedback`、`app-settings`、`workspace-browsing`、`download-directory`）的 Purpose 已正确写入主规格。
