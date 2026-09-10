## Purpose

定义 Android 与 macOS 客户端通过阿里云官方 OSS SDK 执行对象存储操作时的平台桥接、STS 会话、文件路径边界和统一错误契约。

## Requirements

### Requirement: 各平台使用阿里云官方 OSS SDK
系统 SHALL 在 Android 使用阿里云 OSS Android SDK，在 macOS 使用阿里云 OSS SDK for Swift V2 执行 OSS 请求。生产客户端 MUST NOT 保留或调用 Dart 手写 OSS REST、签名、XML 解析、分片传输或 HTTP fallback。

#### Scenario: Android 执行对象操作
- **WHEN** Android 客户端发起任意 OSS 对象操作
- **THEN** 系统通过 Android 官方 OSS SDK执行请求并将结果转换为统一 Flutter 数据模型

#### Scenario: macOS 执行对象操作
- **WHEN** macOS 客户端发起任意 OSS 对象操作
- **THEN** 系统通过 OSS SDK for Swift V2 执行请求并将结果转换为统一 Flutter 数据模型

#### Scenario: 原生 SDK 请求失败
- **WHEN** 官方 OSS SDK返回网络、鉴权或服务错误
- **THEN** 系统向 Flutter 返回统一错误码且不得自动回退到 Dart OSS HTTP 实现

### Requirement: 原生 SDK覆盖全部对象存储操作
统一 OSS 桥接层 SHALL 支持对象与目录列举、分页列举、目录占位对象创建、文件上传、文件下载、受限内容读取、图片处理读取、单对象删除、批量删除、对象复制和运行中传输取消。Android 与 macOS MUST 对这些操作提供等价的 Flutter 可观察语义。

#### Scenario: 列举和管理对象
- **WHEN** Flutter 请求列举、创建目录、删除、批量删除或复制对象
- **THEN** 当前平台的官方 SDK执行对应 OSS 操作并返回平台无关的结果

#### Scenario: 读取图片处理结果
- **WHEN** Flutter 为图片对象请求预设缩略图规格
- **THEN** 当前平台的官方 SDK使用 OSS 图片处理参数读取受限大小内容并返回缩略图字节

#### Scenario: 两端行为一致
- **WHEN** Android 与 macOS 对相同 OSS 配置和对象执行同类操作
- **THEN** Flutter 获得字段、状态和错误语义一致的结果

### Requirement: OSS 操作使用 STS 临时凭证
系统 SHALL 将 FC 下发的 Endpoint、Region、Bucket 和 STS 临时凭证原子配置到原生 OSS 桥接层。原生层 MUST NOT 持久化 AccessKeySecret 或 SecurityToken，退出登录时 MUST 清除凭证及 SDK 客户端状态。

#### Scenario: 有效会话配置原生 SDK
- **WHEN** 用户登录、恢复会话或刷新 STS 成功
- **THEN** Flutter 将最新 OSS 配置和临时凭证更新到当前平台适配器，后续请求使用该配置

#### Scenario: 用户退出登录
- **WHEN** 用户退出登录或会话被清除
- **THEN** 原生适配器清除临时凭证、SDK 客户端及运行中请求引用

#### Scenario: 凭证失效
- **WHEN** SDK因临时凭证过期拒绝 OSS 请求
- **THEN** 原生层返回统一凭证失效错误，由 Flutter 刷新凭证后按任务重试规则重新发起

### Requirement: 大文件传输使用本地文件路径
上传和下载 SHALL 以本地文件路径作为 Flutter 与原生 SDK之间的文件内容边界。系统 MUST NOT 在上传前将完整大文件读取为 Dart `List<int>`，也 MUST NOT 通过平台通道传递完整大文件内容。

#### Scenario: 上传本地文件
- **WHEN** 用户选择文件并创建上传任务
- **THEN** Flutter 将任务标识、对象键和可读本地路径传给原生 SDK，由原生 SDK直接读取文件上传

#### Scenario: 下载对象到本地
- **WHEN** 用户创建下载任务并指定目标路径
- **THEN** 原生 SDK将对象写入临时文件，成功后完成落盘，失败或取消时清理未完成文件

#### Scenario: 读取受限预览内容
- **WHEN** 缩略图或受限文本预览需要将内容返回 Flutter
- **THEN** 系统仅在既定大小上限内通过平台通道返回字节，超过上限的对象使用文件路径或拒绝字节读取

### Requirement: 平台桥接提供稳定数据和错误契约
平台 OSS 桥接层 SHALL 使用统一方法参数、结果字段、传输事件和错误码连接 Flutter 与两端 SDK。原生 SDK类型和未处理异常 MUST NOT 越过平台边界，凭证秘密 MUST NOT 出现在错误信息或日志中。

#### Scenario: 返回对象列表
- **WHEN** 原生 SDK成功返回对象和目录前缀
- **THEN** 适配器将结果转换为统一的对象键、大小、更新时间、ETag、存储类型和目录标识字段

#### Scenario: 映射平台异常
- **WHEN** Android 或 macOS SDK抛出平台特定异常
- **THEN** 适配器返回稳定错误码以及脱敏的 OSS 状态、错误码和 requestId

#### Scenario: 日志涉及鉴权数据
- **WHEN** 系统记录 SDK请求或错误诊断信息
- **THEN** 日志不得包含完整 AccessKeySecret 或 SecurityToken
