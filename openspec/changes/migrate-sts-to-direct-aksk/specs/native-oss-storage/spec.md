## RENAMED Requirements

- FROM: `### Requirement: OSS 操作使用 STS 临时凭证`
- TO: `### Requirement: OSS 操作使用登录下发的访问密钥`

## MODIFIED Requirements

### Requirement: OSS 操作使用登录下发的访问密钥
系统 SHALL 将服务端登录时下发的 Endpoint、Region、Bucket、RootPrefix 和 pdd-client 长期 AccessKey（AccessKeyId/AccessKeySecret）原子配置到原生 OSS 桥接层。原生层 MUST NOT 持久化 AccessKeySecret，MUST NOT 依赖 SecurityToken 或凭证刷新，退出登录时 MUST 清除凭证及 SDK 客户端状态。

#### Scenario: 有效会话配置原生 SDK
- **WHEN** 用户登录成功并从服务端获取 OSS 连接信息与访问密钥
- **THEN** Flutter 将该配置和长期 AccessKey 更新到当前平台适配器，后续请求使用该配置

#### Scenario: 用户退出登录
- **WHEN** 用户退出登录或会话被清除
- **THEN** 原生适配器清除访问密钥、SDK 客户端及运行中请求引用

#### Scenario: 凭证失效
- **WHEN** SDK 因访问密钥被撤销或权限不足拒绝 OSS 请求
- **THEN** 原生层返回统一鉴权失败错误，由 Flutter 引导用户重新登录获取新密钥，而非自动刷新临时凭证

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
- **THEN** 日志不得包含完整 AccessKeySecret 或任何长期访问密钥秘密
