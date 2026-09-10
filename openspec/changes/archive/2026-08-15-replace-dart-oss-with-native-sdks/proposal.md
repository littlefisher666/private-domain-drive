## Why

当前 Flutter 客户端在 Dart 中手写 OSS REST 请求、签名、XML 解析和分片传输，无法稳定获得可信的原生上传进度与速度，同时会在上传前将大文件整体读入内存。Android 与 macOS 已有阿里云官方 OSS SDK，应由平台原生 SDK 统一接管全部对象存储操作，减少协议实现风险并改善大文件传输体验。

## What Changes

- Android 使用阿里云 OSS Android SDK 执行全部 OSS 对象操作。
- macOS 使用阿里云 OSS SDK for Swift V2 执行全部 OSS 对象操作。
- 新增统一的 Flutter 平台 OSS 桥接契约，以方法调用发起对象操作、以事件流上报传输进度和状态。
- 上传入口改为传递本地文件路径，不再将完整文件读取为 Dart `List<int>` 或跨平台通道复制大文件内容。
- 上传、下载进度以官方 SDK 回调的实际传输字节为数据源，速度由 Flutter 使用时间窗口统一计算；最终任务成功仍以 OSS SDK 成功响应为准。
- 保留现有 STS 临时凭证、根前缀限制、能力控制、任务队列、缩略图缓存和失败降级等业务边界。
- **BREAKING** 删除 Dart 手写 OSS REST、签名、XML 解析、普通/分片上传和流式下载实现，不提供旧实现或 HTTP fallback。
- **BREAKING** OSS 客户端调用契约从字节型上传迁移为文件路径型上传，并增加显式传输取消和原生事件关联标识。

## Capabilities

### New Capabilities

- `native-oss-storage`: 定义 Android 与 macOS 分别使用阿里云官方 OSS SDK、通过统一 Flutter 桥接执行全部对象操作、管理 STS 凭证及映射错误的行为。

### Modified Capabilities

- `transfer-queue-management`: 补充上传真实进度、速度、原生传输取消以及 OSS 最终确认前的任务状态要求。

## Impact

- 客户端 Flutter 基础设施层、工作区上传入口、传输队列、预览与缩略图读取调用链。
- Android Gradle 依赖、Kotlin 原生适配和 Flutter 平台通道注册。
- macOS Swift Package/构建依赖、Swift 原生适配和 Flutter 平台通道注册。
- 移除 Dart OSS 签名与 XML 协议代码；`crypto` 依赖在无其他调用后删除，`http` 仅保留给 FC 等非 OSS 请求使用。
- 现有 `oss-image-thumbnails` change 的行为要求继续保留，但其 OSS 图片处理请求改由两端官方 SDK 执行。
- 同步更新 `docs/技术文档.md` 与 `docs/Flutter架构设计.md` 中的 OSS 技术选型、平台边界和传输流程。
- 当前验收阶段优先完成 macOS 自动化与真实 OSS 测试；Android SDK实现保留，但不纳入本次测试和验收范围。
