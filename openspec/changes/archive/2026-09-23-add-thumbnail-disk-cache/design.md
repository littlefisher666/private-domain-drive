# 设计：图片缩略图与预览的本地磁盘缓存

## Context

当前缩略图链路：`FileTypeThumbnail`（client/lib/shared/widgets/file_icon.dart）维护静态字节 Map（LRU 上限 100 条）+ in-flight 去重 + 6 并发许可，未命中时经 `AppController.loadThumbnail()` → `OssClient.downloadThumbnail()` 实时向 OSS 请求 320px 处理结果。图片详情页 `_ImagePreviewBody` 经 `loadImagePreview()` → `OssClient.downloadImagePreview()` 请求 1600px 预览，无任何缓存。缓存键为 `namespace|path|objectVersionToken|process 参数`，`objectVersionToken` 由对象 size + LastModified 组成，已能保证对象更新后的缓存失效。

平台：Android 与 macOS 共用业务逻辑，缓存目录需跨平台（`path_provider` 的 `getTemporaryDirectory()`）。项目不引入数据库、不引入重型依赖。

## Goals / Non-Goals

**Goals:**

- 冷启动后网格缩略图直接命中磁盘缓存，秒开。
- 重复打开图片详情页时预览图命中磁盘缓存，秒开。
- 磁盘占用有上限，超限按 LRU 淘汰。
- 缓存层对加载失败稳定降级：读写失败都当作缓存不存在，回源 OSS。

**Non-Goals:**

- 不做缩略图预生成/后台上传（继续 OSS 实时图片处理）。
- 不做跨设备同步的缓存索引，不引入数据库。
- 不改变 6 并发限制、in-flight 去重、对象版本失效逻辑。
- 不引入 `flutter_cache_manager`。

## Decisions

### D1：自实现轻量磁盘缓存，不引入 flutter_cache_manager

`flutter_cache_manager` 自带 WebHelper/数据库/清理逻辑，但与其鉴权（每次请求需会话签名重签）和缓存键模型（含 process 参数、对象版本）集成需较多适配，且引入 sqlite 依赖。项目约束偏好轻量，自实现约百余行：缓存目录 + 文件级读写 + 内存记录元信息做 LRU。备选方案 flutter_cache_manager 被否，理由如上。

### D2：缓存文件名使用现有缓存键的 hash，元信息内嵌

缓存键含 `|`、对象路径等不适合直接做文件名的字符。对完整缓存键做 SHA-256，以十六进制串作为文件名（`thumbnails/`、`previews/` 两个子目录区分规格类别）。LRU 所需的 last-used 时间戳与原始 key 用同目录内的单一内存索引维护，应用启动时扫描目录重建索引（读文件 mtime 与 size，无需额外元数据文件），避免索引与文件不一致的问题。

### D3：淘汰策略为总字节上限的 LRU

- 缩略图目录上限 500MB（320px 单张约 10–30KB，实际几乎全量保留，仅作保险丝）。
- 预览目录上限 1GB。
- 两个目录独立计费、独立淘汰，写入后触发检查；LRU 按 last-used 时间从旧到新删除。时间戳来源：优先文件系统 mtime（每次命中 touch 文件），避免引入索引序列化格式。

### D4：缩略图组件改用磁盘缓存 + Flutter ImageCache

- `FileTypeThumbnail` 删除静态 `_cache` Map 与手写 LRU 淘汰（`_inFlight`、6 并发许可、失败上报保留）。
- 加载路径：loader 回调（即 `AppController.loadThumbnail`）内部先查磁盘缓存，命中返回字节；未命中回源 OSS 后写磁盘。组件继续用 `MemoryImage`（字节在手的场景与现 UI 结构改动最小），解码后的图像缓存由 Flutter `ImageCache` 按 provider 处理。
- 备选方案：改用自定义 `ImageProvider` 直接接磁盘文件（`FileImage`）可省一次字节拷贝，但会重构 loader 回调接口与预览页，收益小，不采纳。

### D5：预览接入方式为 loader 侧透明缓存

`AppController.loadImagePreview()` 与 `loadThumbnail()` 走同一个磁盘缓存工具（不同子目录与上限），`_ImagePreviewBody` 无需感知缓存。预览命中时 future 立即完成，转圈消失。

### D6：磁盘 IO 全部经 `compute`/隔离不必要，直接异步 IO

单张缩略图文件几十 KB，`File.readAsBytes`/`writeAsBytes` 已是异步实现，无需 isolate。写入采用"先写临时文件再 rename"避免半写文件被读取。

## Risks / Trade-offs

- [缓存目录扫描在启动时阻塞] → 目录条目通常数千以内，`File.stat` 异步并发读取，实际耗时可忽略；不阻塞首帧。
- [Android 磁盘配额紧张] → 1GB 预览上限偏高，采用 1GB；写入失败按规格稳定降级为回源，不影响功能。
- [touch 文件频繁导致元数据写放大] → 每次命中一次 `setLastModified`，量级可接受；若未来成瓶颈可改为内存索引优先、mtime 兜底。
- [多进程/多窗口同时写缓存] → 单实例客户端场景下不构成问题，rename 原子性已避免半写。
- [对象版本变化导致旧缓存残留] → 旧 key 对应文件成为孤儿，由 LRU 淘汰兜底；不主动清理（版本 token 含 LastModified，孤儿量可控）。

## Migration Plan

- 纯新增基础设施 + 组件内改造，无数据迁移。旧内存缓存随代码删除。
- 回滚：还原相关提交即可，磁盘缓存目录残留文件由系统缓存目录策略自然清理，无副作用。

## Open Questions

（无——上限取值 500MB/1GB 依据上文权衡确定，可实施后在真机上按体验微调。）
