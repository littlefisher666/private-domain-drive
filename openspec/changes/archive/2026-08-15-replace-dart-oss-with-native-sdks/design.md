## Context

客户端当前通过 Dart `OssClient` 手写 OSS REST 请求，包含 Header 签名、XML 解析、列表与批量删除、普通及分片上传、下载落盘、对象复制和图片处理读取。上传入口使用 `file_picker` 读取完整字节后入队，传输回调只能反映 Dart/HTTP 缓冲或分片完成，不能稳定提供用户可感知的连续进度和可信速度；运行中的取消也无法可靠中止底层上传请求。

本次变更跨越 Flutter、Android 和 macOS 三层，并引入两套阿里云官方 SDK：Android 使用 OSS Android SDK，macOS 使用 OSS SDK for Swift V2。FC 仍负责登录、STS 与配置下发，文件内容继续由客户端直连 OSS，不经过 FC。

现有 `oss-image-thumbnails` change 已在 Dart `OssClient` 中加入带 `x-oss-process` 的缩略图读取。迁移必须保留其产品行为，但由原生 SDK 执行 OSS 请求；Flutter 继续负责缩略图缓存、解码和失败降级。

## Goals / Non-Goals

**Goals:**

- 由 Android 和 macOS 官方 SDK 全量执行 OSS 对象操作，并删除 Dart OSS 协议实现和 fallback。
- 在 Flutter 层提供平台无关、可测试的统一 OSS 接口，保持现有业务调用方不感知 SDK API 差异。
- 大文件上传和下载均基于本地文件路径执行，避免完整文件驻留 Dart 内存或跨平台通道复制。
- 使用 SDK 传输回调提供实际字节进度、显式取消和一致错误映射，并由 Flutter 统一计算平滑速度。
- 保留 STS 临时鉴权、根前缀约束、传输队列、缩略图与现有对象操作语义。

**Non-Goals:**

- 不改变 FC 登录、STS 签发、能力信息或 OSS 配置接口。
- 不将文件上传下载改为经过 FC 中转。
- 不保留 Dart 手写 OSS 请求作为回滚开关、兼容路径或隐藏 fallback。
- 不在本次变更中增加数据库、后台任务守护进程或跨应用重启的断点恢复。
- 不统一 Android 与 Swift SDK 的内部类结构；只统一 Flutter 可观察的业务契约。

## Decisions

### 1. 使用一个本地 Flutter 插件封装双端 SDK

在客户端内建立单一平台 OSS 插件，包含公共 Dart facade、Android Kotlin 实现和 macOS Swift 实现。普通请求通过 `MethodChannel` 调用，上传下载进度通过长期 `EventChannel` 上报，事件以 `taskId` 关联 Flutter 任务。

选择独立插件而不是将大量通道处理直接写入 `MainActivity` 和 `AppDelegate`，是为了隔离 SDK 依赖、平台模型转换和生命周期管理，并允许 Dart 单元测试替换 facade。替代方案是在 Runner 中直接注册通道，初始文件更少，但全量对象操作会快速放大两个入口文件的职责。

公共契约覆盖：配置/清理 STS、列表与分页列表、创建目录占位对象、上传文件、下载到文件、受限小对象读取、单删与批删、对象复制、图片处理读取和传输取消。两端适配器 MUST 返回同构 Map/List/TypedData，不向 Flutter 暴露 Java、Kotlin 或 Swift SDK 类型。

### 2. OSS 协议实现只存在于官方 SDK 路径

Android SDK 与 Swift V2 SDK 分别负责请求签名、临时安全令牌、REST/XML 协议、重试、分片与校验。Dart 原有签名、XML 标签解析、`http` OSS 请求和手写分片代码全部删除。Flutter `http` 仅用于 FC 等非 OSS 接口；`crypto` 若无其他使用则移除。

选择全量替换而不是只用原生 SDK处理传输，是为了避免列表、删除、复制和缩略图继续依赖第二套签名及错误处理路径。代价是迁移面更大，但消除了长期双实现漂移。

### 3. STS 会话由 Flutter 刷新，原生层原子更新

Flutter 保留 `ensureFreshCredentials` 和过期判断。登录、恢复或刷新成功后，通过插件配置接口向原生层传入 Endpoint、Region、Bucket、AccessKeyId、AccessKeySecret、SecurityToken 和过期时间；退出登录时清除原生凭证与 SDK 客户端。

每个已启动请求持有启动时的凭证快照；新凭证只影响后续请求。鉴权失效由原生错误映射为统一错误码，Flutter 完成刷新后按现有任务重试规则重新发起。凭证不得写入持久存储或完整日志。

### 4. 文件传输以路径为边界，小内容读取设置上限

上传接口接受 `localPath`，下载接口接受 `targetPath`，原生 SDK直接读写文件。文件选择使用 `withData: false` 并保留 `PlatformFile.path`；上传任务记录源路径供重试。下载继续写入 `.part` 临时路径，SDK 成功后再由 Flutter 或原生层完成原子改名，失败与取消必须清理临时文件。

缩略图和受限文本/图片预览允许通过平台通道返回 `Uint8List`，但必须受既有预览或缩略图尺寸上限约束。大文件不得通过 TypedData 返回。

### 5. SDK 字节回调是进度数据源，任务完成以请求结果为准

原生进度事件统一包含 `taskId`、`direction`、`transferredBytes` 和 `totalBytes`。Flutter 对事件按任务单调更新，并以最近时间窗口的字节增量计算速度；UI 更新需要节流，避免高频回调导致重建压力。

当 SDK 已发送全部字节但尚未返回最终成功时，任务保持 `running` 并显示“正在确认”；只有 SDK 成功结果才能将任务置为 `success`。取消运行中任务时，Flutter 必须调用原生 `cancel(taskId)`，原生适配器保存 SDK 请求句柄并执行真实取消，而不是只修改 UI 状态。

速度选择在 Flutter 统一计算，而不直接采用两端 SDK各自格式，是为了保持 Android 与 macOS 展示口径一致并便于测试。

### 6. 业务约束留在 Flutter，OSS 能力留在原生适配器

根前缀校验、角色能力、目录显示、任务队列、批次汇总、重试策略和缩略图缓存继续位于 Flutter。原生层只接受已校验的对象键并执行 OSS 操作。SDK 返回的对象模型在原生层转换为统一字段：key、size、lastModified、etag、storageClass 和目录前缀。

图片缩略图请求由原生 SDK附加官方图片处理参数，Flutter 仍决定哪些扩展名需要缩略图、缓存键以及加载失败后的图标降级。

### 7. 统一错误码并保留原生诊断信息

两端将 SDK 异常映射为稳定错误码，包括 `credentialExpired`、`accessDenied`、`notFound`、`networkUnavailable`、`canceled`、`invalidRequest`、`serviceError` 和 `unknown`。Flutter 面向用户显示统一中文信息；调试字段可包含脱敏后的 requestId、HTTP 状态与 OSS 错误码，不包含 AccessKeySecret 或 SecurityToken。

## Risks / Trade-offs

- **[两套官方 SDK API 能力或版本要求不完全一致]** → 以公共契约最小交集为基线，为图片处理和批量操作分别验证两端官方 API；固定已联调的 SDK 版本。
- **[Swift V2 SDK 的最低 macOS 版本高于当前 10.15]** → 实施首项核实官方兼容矩阵；若不兼容，先明确升级项目最低版本，不允许回退到 Dart OSS 实现。
- **[Android 文件路径或 macOS 沙盒授权在排队期间失效]** → 文件选择后验证路径可读；需要时复制到应用临时目录，并在任务结束后清理。
- **[EventChannel 高频事件造成 UI 压力]** → 原生层或 Flutter 层按时间/字节阈值节流，同时保证最终字节事件不丢失。
- **[全量替换导致列表、批删、复制或缩略图行为回归]** → 先建立平台无关契约测试和两端适配测试，再逐项切换调用链；使用真实 OSS 对象完成 Android 与 macOS 冒烟验证。
- **[现有缩略图 change 与本次修改同一文件]** → 保留其规格行为，将未完成的真实 OSS 与双端体验验证并入迁移后的 SDK 实现验证，避免继续强化即将删除的 Dart 协议层。
- **[无旧实现 fallback 增加发布风险]** → 通过版本回滚而不是运行时双实现回滚；发布前必须完成双端核心对象操作清单。

## Migration Plan

1. 核实并固定 Android OSS SDK 与 OSS SDK for Swift V2 的兼容版本、安装方式和最低系统要求。
2. 建立本地 Flutter 插件、统一数据模型、方法契约、进度事件和错误码，不切换业务调用方。
3. 分别实现 Android 与 macOS 的 STS 配置及全部对象操作；本次先完成 macOS 适配层测试，Android 测试延后。
4. 将上传入口改为本地路径，将下载、预览和缩略图调用迁移到统一 facade。
5. 切换 AppController 与所有 OSS 调用方，接入真实取消、进度和速度计算。
6. 删除 Dart OSS REST/签名/XML/分片实现及不再使用的依赖，确保仓库中不存在 OSS HTTP fallback。
7. 优先完成 macOS 真实 OSS 冒烟验证和传输中心验收，更新项目技术与 Flutter 架构文档；Android SDK实现保留，Android测试延后到后续兼容阶段。

若发布后发现阻断问题，回滚整个客户端版本；不在同一版本中重新启用旧 Dart OSS 代码。

## Open Questions

- OSS SDK for Swift V2 当前推荐的依赖集成方式及其最低 macOS 版本是否与项目的 macOS 10.15 目标兼容。
- 两端官方 SDK对断点续传任务持久化的能力是否一致；本次默认只要求单次进程内重试和取消。
- macOS 文件选择后的沙盒授权能否覆盖长时间排队任务，是否需要统一复制到应用管理的临时目录。
