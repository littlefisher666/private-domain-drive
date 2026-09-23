# 提案：为图片缩略图与预览增加本地磁盘缓存

## Why

当前缩略图仅有进程内字节缓存（上限 100 条），应用冷启动后所有缩略图需重新从 OSS 拉取，翻回旧目录时早期条目已被淘汰，再次发起网络请求；图片详情页的 1600px 预览图则完全没有缓存，每次点击都全新下载，用户感知到明显的等待。增加本地磁盘缓存可以让冷启动秒开网格、重复打开详情秒开，显著减少 OSS 流量与请求次数。

## What Changes

- 新增自实现的磁盘缓存层（基于 `path_provider` 缓存目录，不引入 `flutter_cache_manager`），缓存文件名沿用现有缓存键 `namespace|对象路径|对象版本|处理参数`。
- 320px 缩略图结果写入磁盘缓存，策略为"全量缓存 + 宽松上限"（总量约 500MB 或 2000 条，几乎不会触发淘汰）。
- 1600px 详情预览图接入同一磁盘缓存，并设置总量上限（约 1GB）的磁盘 LRU 淘汰。
- 移除 `FileTypeThumbnail` 中自维护的 100 条内存字节 Map 与手写 LRU 淘汰，解码后图像的内存缓存交给 Flutter 自带 `ImageCache`。
- 保留现有 6 个并发加载请求的限制与 in-flight 请求去重，保护网络与 OSS。
- 缓存失效逻辑不变：继续使用 `objectVersionToken`（对象大小 + LastModified），对象更新后自动生成新缓存键，不展示旧版本。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `oss-image-thumbnails`：缓存需求从"进程内缓存"扩展为"进程内 + 本地磁盘缓存"，磁盘缓存需区分缩略图与预览两类用途并设置总量上限与 LRU 淘汰；图片详情页预览需复用磁盘缓存；内存字节缓存的行为不再是规格承诺（由 Flutter ImageCache 承担）。

## Impact

- 客户端代码（`client/lib/shared/widgets/file_icon.dart`、`client/lib/shared/state/app_controller.dart`、`client/lib/features/workspace/infrastructure/oss_client.dart` 或新增缓存基础设施文件）。
- 新增依赖：`path_provider`（获取平台缓存目录）。
- 受影响的测试：`client/test/file_thumbnail_test.dart`、`client/test/oss_client_test.dart`，新增磁盘缓存单元测试。
- 行为影响：冷启动与重复访问场景下 OSS 请求量下降；磁盘占用增加（有上限约束）；对象更新后缓存键变化，不产生旧图误展示。
