# Design

## Context

本变更只落在 `client/` 的 Flutter 客户端，服务端、OSS 对象结构与凭证方案不变。现有实现已有可复用的基础：

- 图片预览与相册桌面查看器分别基于 `GestureDetector` 与 `InteractiveViewer`，两端缩放能力不一致。
- 回收站已有单条恢复/彻底删除与 `RecycleBinController`，但列表关闭了多选，也没有批量与清空入口。
- 错误提示大多直接 `error.toString()`，`AppError.toString()` 会带出错误码；部分加载失败直接把异常对象拼进文案。
- 图片、文档、相册原图与分享临时文件四类缓存各自封装目录，但没有统一的容量统计与清理入口。
- 文件页已有排序、多选、框选与部分快捷键；缺失当前目录筛选、移动端下拉刷新和 Space/Enter/Delete/⌘R。
- 下载目录选择器每次固定定位到系统下载目录（Android 还硬编码了 `EXTRA_INITIAL_URI`），没有记忆。
- 传输中心并发设置只在桌面头部组件中，移动端更多菜单没有入口；清除已结束任务没有确认。

## Goals / Non-Goals

**Goals:**

- 用最小改动补齐双端一致的高频交互，不新增后端接口、不改变 OSS 路径与对象协议。
- 复用现有组件与控制器（`InteractiveViewer`、`RecycleBinController`、`TransferQueue`、`AppFeedback`），避免引入新依赖。
- 让新增行为可测试：缩放状态、筛选结果、批量恢复冲突、缓存统计、目录记忆回退均可通过 Widget/单元测试覆盖。

**Non-Goals:**

- 不做递归搜索、全盘搜索或服务端搜索索引；筛选只作用于当前已加载目录。
- 不做回收站条目内部对象的多选恢复；恢复粒度仍是回收条目。
- 不改变下载任务并发模型、断点续传或 OSS 传输实现。
- 不新增缓存分类设置、自动清理策略或缓存上限配置。

## Decisions

### 1. 缩放复用 `InteractiveViewer`，用缩放比例协调滑动手势

图片预览页在 `_ImagePreviewBody` 外层包 `InteractiveViewer`（`minScale: 1`、`maxScale: 4`、`panEnabled` 仅在放大后开启），通过 `TransformationController` 监听当前比例：

- 比例等于 1x 时保留现有的左右/上下滑动切换。
- 比例大于 1x 时禁用切换手势，单指拖动交给 `InteractiveViewer` 平移。
- 双击使用 `onDoubleTapDown` 获取点击位置，在 1x 与预设比例（2.5x）之间动画切换。
- 图片路径变化时把变换矩阵重置为单位矩阵，满足「切图重置」。

相册移动端查看器同样包 `InteractiveViewer`，并把现有 `onHorizontalDragEnd` 切换逻辑改为仅在 1x 时生效；桌面查看器已使用 `InteractiveViewer`，只补充切图重置与手势协调。视频条目不包缩放层。

备选方案：引入 `photo_view` 等第三方库。放弃原因是内置 `InteractiveViewer` 已满足 1x–4x、双击与边界约束，且桌面相册已在用，新增依赖没有收益。

### 2. 回收站批量操作使用页面本地选择状态，不接入文件页多选

`RecycleBinPage` 已有自己的 `_selected`，但文件页多选状态属于 `WorkspaceController` 且与工作区路径强绑定，直接复用会污染文件页选择。因此：

- 在 `RecycleBinPage` 内新增 `Set<String> _selectedEntryPaths`、多选模式与全选状态，桌面端复用现有 `WorkspaceListView` / `WorkspaceGridView` 的 `selectedPaths`、`multiSelecting`、`onToggle`、`onMarqueeSelectionChanged` 参数；移动端长按进入多选。
- 多选只在回收站根层启用；进入条目内部时传空选择集合并关闭多选。
- 新增轻量 `RecycleBinBatchBar`，只包含恢复、立即删除、全选/取消全选，避免把文件页的下载/移动/分享动作塞进回收站。
- 批量恢复与批量彻底删除复用 `RecycleBinController.restoreRecycleBinEntry` / `purgeRecycleBinEntry`，按条目串行执行并复用现有进度横幅模式；逐条继续而非整批中断，结束后汇总成功/失败数量。批量恢复的冲突处理直接复用单条恢复的「已还原」改名逻辑，不新增规则。
- 「清空回收站」在根层工具栏/移动端菜单提供，确认后遍历当前条目执行彻底删除。

备选方案：为回收站新增后端批量接口。放弃原因是一期数据量小、条目数有限，串行复用现有单条接口即可，避免新增接口与鉴权面。

### 3. 错误文案收敛到 `AppFeedback.showError`

保留 `AppError.toString()` 供日志使用，新增用户文案解析：

- `AppError` 取 `message`；`StateError` 取 `message`；其余异常统一为「操作失败，请稍后重试」。
- 新增 `AppFeedback.showError(context, error)`：按上述规则展示 SnackBar，同时 `debugPrint` 完整 `error` 与堆栈。
- 替换表现层中约 20 处 `error.toString()` / `replaceFirst('Bad state: ', '')`；回收站加载失败改为「回收站加载失败，请稍后重试」+ 重试按钮。

备选方案：直接把 `AppError.toString()` 改成只返回 `message`。改动更小，但会丢失日志中的错误码，排障能力下降；集中到反馈层可以同时满足用户文案与日志完整性。

### 4. 缓存管理由各缓存仓库暴露目录与清理能力

新增 `CacheManager` 组合四类缓存：

- `DiskImageCache`：临时目录 `pdd_image_cache/<kind>`。
- `DiskDocumentCache`：临时目录 `pdd_document_cache`。
- `ShareCacheStore`：临时目录 `pdd_share_cache`。
- `OriginalCacheStore`：应用支持目录 `pdd_original_cache`。

各缓存类新增 `Future<int> sizeBytes()` 与 `Future<void> clear()`：清理时同时清空内存索引并删除磁盘文件，避免索引指向已删除文件。`CacheManager` 负责汇总大小与统一清理。设置页用 `FutureBuilder` 展示占用，清理前 `AppFeedback.confirm`，完成后重新统计并提示释放空间。

清理范围明确不包含：系统下载目录、`sqflite` 传输历史/相册索引数据库、`SharedPreferences` 会话与设置。导入 `share_import` 的 `cacheDir/shared-import` 属于分享接收临时文件，不纳入本次四类缓存，避免误删尚未完成导入的文件。

### 5. 筛选在页面层裁剪列表，不进入控制器与 OSS

`WorkspacePage` 新增 `_filterQuery` 与输入控制器，在 `_buildItemsArea` 合并目录摘要后、交给列表/网格前裁剪：

```
final visibleItems = _filterQuery.isEmpty ? items : items.where(名称包含).toList();
```

- 列表、网格、批量条、全选与键盘选择统一使用 `visibleItems`，保证筛选状态下批量操作只作用于可见结果。
- 筛选变化时把多选集合裁剪到可见路径，避免误删被筛掉条目。
- 目录切换时清空查询（复用现有目录绑定回调）。
- 桌面筛选框放在 `WorkspaceDesktopBody` 工具栏；移动端在 `WorkspaceMobileHeader` 增加搜索图标，展开为输入行。
- 空结果展示独立提示，不复用「目录为空」上传引导。

备选方案：把筛选放到 `WorkspaceController`。放弃原因是筛选是纯视图状态，不应触发目录监听、缓存或重建逻辑，也不需要跨页面保留。

### 6. 下拉刷新包在移动端列表外层，快捷键复用现有 KeyEvent 入口

- 移动端文件页与回收站列表外层包 `RefreshIndicator`，`onRefresh` 直接调用现有 `_reload`（两者都已返回 `Future`）；列表使用 `AlwaysScrollableScrollPhysics`，保证短列表与空态也能下拉。刷新失败由现有加载逻辑保留旧数据并走 `AppFeedback.showError`。
- 桌面快捷键继续放在 `workspace_page_build.dart` 现有 `Focus.onKeyEvent`：
  - Space：对当前主选中文件调用 `_openPreview`，文件夹不处理。
  - Enter：调用 `_rename`，权限校验沿用现有逻辑。
  - Delete / ⌘⌫（`delete` 与 `backspace`）：多选时 `_deleteSelected`，单选时 `_delete`，复用确认框。
  - ⌘R：`_reload`。
  - 输入框与就地重命名获得焦点时事件不会进入文件区 `Focus`，天然满足「输入状态不触发」。

### 7. 下载目录记忆放在客户端偏好存储，原生选择器接收初始位置

新增 `DownloadDirectoryStore`（`SharedPreferences`）：

- Android 存 `ACTION_OPEN_DOCUMENT_TREE` 返回的持久化 URI；macOS 存目录路径。
- `selectDownloadDirectory()` 增加可选 `initialDirectory` 参数，并把记忆值传给原生通道。
- Android `MainActivity`：把 `EXTRA_INITIAL_URI` 从硬编码 Download 改为传入 URI；无有效授权或 URI 解析失败时回退 `primary:Download`；用户确认后继续 `takePersistableUriPermission` 并回传新 URI。
- macOS：`panel.directoryURL` 优先使用记忆路径，路径不存在时回退系统下载目录。
- 单文件与批量下载在用户确认目录后写入记忆；取消不写入。Android 相册类媒体文件仍直接保存到系统相册，不经过目录选择器。

备选方案：首次选择后后续下载不再询问。放弃原因是用户仍需按场景切换目录，且 Android scoped storage 下跳过选择器会削弱可控性。

### 8. 传输中心复用同一并发弹窗与清除确认

- 把 `_showConcurrencyPicker` 从桌面专用 `TransferHeaderActions` 提升为共享函数；移动端 `PopupMenuButton` 增加「传输并发数」项调用同一函数。
- 清除已结束任务前统计 `task.isFinished` 数量，统一走 `AppFeedback.confirm`；桌面按钮与移动端菜单共用同一 helper。入口是否可用改为判断是否存在已结束任务。
- 空态 CTA 由 `TransferTasksPage` 接收可选 `onOpenFiles` 回调：`HomeShell` 桌面传 `_selectPage(0)`、移动传 `_select(0)`；非嵌入式页面不展示 CTA。空态在历史加载完成且列表为空时展示，类型筛选为空时仍使用类型文案。

## Risks / Trade-offs

- [缩放与滑动手势冲突] → 用缩放比例作为唯一开关；切图重置矩阵；双端手工验证放大后拖动、缩到 1x 后恢复切换。
- [回收站批量恢复中途失败] → 串行执行并逐条汇总，失败条目保留；不整批回滚，避免已恢复内容被再次删除。
- [缓存清理删到正在使用的文件] → 清理前检查传输队列是否活跃？本次不做自动跳过；通过二次确认与「清理后按需重新生成」降低影响。原图缓存清理可能让相册需要重新下载，UI 文案明确提示「清理后再次查看会重新下载」。
- [筛选后全选误删被隐藏条目] → 列表、全选、批量条统一使用裁剪后的列表，并在筛选变化时裁剪选择集合。
- [Android 记忆目录授权失效] → 原生层捕获授权异常并回退默认目录，不阻断下载；用户重新选择后覆盖记忆。
- [错误文案统一后丢失排障信息] → `AppFeedback.showError` 始终 `debugPrint` 原始异常与堆栈，release 包也不静默吞掉。

## Migration Plan

- 无数据库迁移；新增 `SharedPreferences` 键（下载目录记忆）缺失时按无记忆处理。
- 缓存清理只删除缓存目录内容，不修改目录结构；回滚版本仍可正常创建缓存。
- 发布前同步 `docs/技术文档.md` 中图片预览、文件浏览、回收站、下载与传输中心的交互说明。
- 出现问题时可按能力独立回滚：缩放、筛选/刷新/快捷键、回收站批量、缓存管理、下载记忆、传输中心互不依赖，可分批提交与回退。

## Open Questions

- Android 相册媒体下载直接保存到系统相册，是否需要同样展示「上次下载目录」入口？本次维持现状，后续按用户反馈再定。
