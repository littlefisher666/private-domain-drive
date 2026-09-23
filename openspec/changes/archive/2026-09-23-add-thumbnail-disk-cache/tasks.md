# 任务：图片缩略图与预览的本地磁盘缓存

## 1. 磁盘缓存基础设施

- [x] 1.1 在 `client/pubspec.yaml` 添加 `path_provider` 依赖并确认两端（Android/macOS）可用
- [x] 1.2 新建磁盘缓存工具类（如 `client/lib/shared/cache/disk_image_cache.dart`）：基于缓存目录的 `thumbnails/`、`previews/` 子目录，SHA-256 缓存键文件名，异步读写（临时文件 + rename）
- [x] 1.3 实现启动时目录扫描重建索引（mtime + size）与总字节上限的 LRU 淘汰（缩略图 500MB、预览 1GB），淘汰/清理失败静默忽略
- [x] 1.4 实现"命中即 touch"（更新 mtime）逻辑与读取失败当未命中处理的降级路径

## 2. 接入加载链路

- [x] 2.1 `AppController.loadThumbnail()` 与 `loadImagePreview()` 接入磁盘缓存：先查磁盘，未命中经 `OssClient` 回源后写入
- [x] 2.2 确认缓存键沿用 `namespace|path|objectVersionToken|process 参数`，对象版本变化后生成新键不读旧缓存

## 3. 移除内存字节缓存

- [x] 3.1 删除 `FileTypeThumbnail` 中静态 `_cache` Map 与手写 LRU 淘汰逻辑，保留 `_inFlight` 去重、6 并发许可与失败上报
- [x] 3.2 清理 `clearMemoryCache()` 的对外暴露与调用点，改为无操作或删除（以实际引用为准）

## 4. 测试与验证

- [x] 4.1 为磁盘缓存工具类编写单元测试：写入/命中/对象版本变化新键/超限淘汰/读写失败降级
- [x] 4.2 更新 `client/test/file_thumbnail_test.dart` 等受内存缓存移除影响的测试
- [x] 4.3 运行 `flutter analyze` 与客户端测试套件
- [x] 4.4 macOS 真机验证：冷启动进入已浏览目录缩略图秒开、重复打开图片详情页秒开、缩略图尺寸切换与失败降级正常
