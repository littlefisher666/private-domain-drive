# 任务：相册索引手动重建入口与存量缩略图补齐可靠性强化

## 1. 手动重建索引入口

- [x] 1.1 `gallery_controller.dart` 新增 `rebuildIndex()` 公开方法：校验登录、进入扫描阶段、复用既有 `_runFullScan`，扫描中防重复触发
- [x] 1.2 `gallery_page.dart` 移动端 AppBar 更多菜单新增"重建照片索引"菜单项（扫描中不触发）
- [x] 1.3 `gallery_page.dart` 桌面端底部状态行右侧新增"重建索引"按钮（扫描中置灰）
- [x] 1.4 macOS 实测：老版本上传漏索引的照片经重建后出现在时间线，OSS 清单对象回写且版本提升

## 2. 存量缩略图补齐可靠性

- [x] 2.1 `photo_index_repository.dart` 补齐由串行 for 循环改为固定 4 路工作池（cursor 领任务模式，与全量扫描一致）
- [x] 2.2 单条补齐抽为 `_backfillEntry`，整体包 90 秒超时：任一环节挂起即放弃该条、继续队列
- [x] 2.3 `_backfillEntryWithRetry` 对 `OSS_NETWORKUNAVAILABLE` 指数退避重试最多 3 次，其余错误原样抛出由调用方跳过
- [x] 2.4 `gallery_config.dart` 新增 `thumbBackfillConcurrency`、`thumbBackfillEntryTimeout`、`thumbBackfillRetryAttempts` 常量

## 3. 双端验证与文档

- [x] 3.1 macOS 实测：26 个无缩略图视频经并发补齐全部出缩略图（含此前被挂起请求堵死的条目与网络瞬断重试条目），失败条目跳过后队列继续、无卡死
- [x] 3.2 新增补齐行为单元测试（`test/gallery_backfill_test.dart`）：挂起超时不堵死队列、瞬断退避重试、持续失败跳过、成功结果写回清单；内存版数据库 + Fake OSS，无平台插件依赖，本地与 Linux CI 均可运行
- [x] 3.3 主仓库：归档后同步 `openspec/specs/`（photo-index 新增手动重建 Requirement、修改存量补齐 Requirement），并更新 submodule 指针
- [ ] 3.4 Android 真机验证：重建索引入口与补齐行为一致（共用 Dart 层，随下一次构建发布验证）
