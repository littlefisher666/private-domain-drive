# 提案：相册索引手动重建入口与存量缩略图补齐可靠性强化

## Why

早期版本客户端上传的媒体没有"上传成功后增量写索引"逻辑，这些照片无法通过自动流程出现在相册时间线，用户没有任何自助修复手段。同时存量无缩略图补齐为串行逐条处理且无超时：实测中单个挂起的 OSS 截帧请求会堵死整个队列（17 分钟零进展、无错误提示），且本机到 OSS 直连链路偶发 SSL 握手瞬断导致部分视频条目补齐失败后只能等待下次会话。

## What Changes

- 相册页新增用户可主动触发的"重建索引"操作（移动端 AppBar 更多菜单 + 桌面端底部状态行按钮）：执行一次全量重扫（递归列举 OSS 媒体对象、复用未变化条目）并回写 OSS 清单对象，清单版本提升后其他设备自动同步；扫描进行中入口不重复触发
- 存量无缩略图条目后台补齐由串行逐条改为固定并发工作池（4 个常驻 worker 领任务）
- 单条补齐整体限时（当前 90 秒）：截帧、下载、缩放、上传任一环节挂起即放弃该条、继续处理队列其余条目；被放弃条目留待下次会话自动重试
- 单条补齐对网络瞬断错误（OSS_NETWORKUNAVAILABLE）做指数退避重试（当前最多 3 次），容忍本机到 OSS 直连链路的偶发瞬断
- 失败条目的"跳过不阻塞其余、下次会话重试"既有行为保持不变

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `photo-index`:
  - 新增 Requirement：用户手动触发索引重建（重建入口、全量重扫、清单回写与多设备同步、扫描中防重复触发）
  - 修改 Requirement「存量无缩略图条目后台补齐」：补充并发处理、单条整体限时、网络瞬断退避重试的执行口径

## Impact

- 客户端（`client/` 子仓库）：
  - `lib/features/gallery/application/gallery_controller.dart`：新增 `rebuildIndex()` 公开方法
  - `lib/features/gallery/presentation/gallery_page.dart`：移动端菜单项与桌面端状态行按钮
  - `lib/features/gallery/infrastructure/photo_index_repository.dart`：补齐工作池化、单条超时与重试
  - `lib/features/gallery/domain/gallery_config.dart`：新增并发数、超时时长、重试次数常量
- Android 与 macOS 双端共用上述 Dart 层实现，行为一致
- 实现与 macOS 端验证已完成（26 个无缩略图视频全部补齐，含此前被挂起请求堵死的条目），对应 client 子仓库提交 `75f16b3`
