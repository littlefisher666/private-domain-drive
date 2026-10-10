## 1. 统计拆分与缓存基础

- [x] 1.1 在 `client/lib/features/workspace/infrastructure/oss_client.dart` 中将 `_readDirectorySummary` 改为公开的 `directorySummary(String path, UserSession session)`，`list()` 移除内联统计调用，文件夹条目不再携带 itemCount/updatedAt
- [x] 1.2 新建 `client/lib/features/workspace/infrastructure/directory_summary_cache.dart`：sqflite 单库（`directory_summaries` 表），提供读、写、增量修正、失效方法，所有异常吞错降级
- [x] 1.3 新建 `client/lib/features/workspace/infrastructure/directory_summary_service.dart`：组合 OssClient 与缓存，提供 `cached()`、受限并发（上限 4）的 `refresh()`（带 generation 防过期回调）、`noteFilesAdded/noteFilesRemoved/invalidate` 写修正接口
- [x] 1.4 在 `FileRepository` 与 `AppController` 上透出 DirectorySummaryService 的能力，供页面与用例调用

## 2. 浏览页面接入

- [x] 2.1 `workspace_page.dart`：目录列表渲染后合并缓存命中值，随后台 `refresh` 逐条回填（setState 更新 `_visibleItems`），统计缺失时保持占位
- [x] 2.2 `workspace_page.dart`：目录切换与手动刷新时递增 generation，丢弃旧目录统计回调
- [x] 2.3 确认排序、返回、重命名、删除等既有交互在条目异步回填下不回归（重点：`_visibleItems` 局部更新不破坏排序与选中状态）

## 3. 写路径挂钩

- [x] 3.1 workspace 上传完成与新建文件夹成功后调用 `noteFilesAdded`（新建文件夹计 1）
- [x] 3.2 单个/批量删除成功后对每条目所属目录调用 `noteFilesRemoved`，失败或部分失败时失效对应目录
- [x] 3.3 移动完成后对源目录 `noteFilesRemoved`、目标目录 `noteFilesAdded`；回收站清空、share_import 等不可靠路径调用 `invalidate`
- [x] 3.4 各写修正完成后触发受影响目录的后台 `refresh` 校准，且不阻塞操作反馈

## 4. 验证

- [ ] 4.1 双端联调（`--dart-define-from-file=env/local.json`）：进入多子文件夹目录，首屏立即渲染、统计逐个补齐、二次进入立即显示缓存值
- [ ] 4.2 验证写场景：上传/删除/移动/建目录后计数即时修正且后台校准后与 OSS 一致；隐藏条目不计入统计
- [ ] 4.3 验证降级：缓存不可用（可临时抛错模拟）时浏览与统计功能正常
- [ ] 4.4 确认目录选择对话框仍不做内容统计（file-move 规格场景不回归）
- [x] 4.5 `flutter analyze` 与既有测试通过，更新 client 子仓库相关测试后提交 client 与主仓库指针
