# 会话凭证下发规范

## Purpose

定义服务端保管双 RAM AccessKey、登录成功后向客户端下发 OSS 直连凭证、以及不再签发或刷新 STS 临时凭证的行为约束。

## Requirements

### Requirement: 服务端保管双 RAM 访问密钥
服务端 SHALL 从环境变量读取 `PDD_SERVER_OSS_ACCESS_KEY_ID/SECRET` 与 `PDD_CLIENT_OSS_ACCESS_KEY_ID/SECRET` 两对长期 RAM AccessKey,并 MUST NOT 依赖 SDK 默认凭证链或 FC 执行角色凭证。`PDD_SERVER_OSS_*` 仅用于读写用户目录,`PDD_CLIENT_OSS_*` 仅用于登录下发。

#### Scenario: 环境变量齐备启动
- **WHEN** 服务端以完整的 `PDD_SERVER_OSS_*` 与 `PDD_CLIENT_OSS_*` 环境变量启动
- **THEN** 服务端可读写 `config/users.json` 并可在登录时下发客户端密钥

#### Scenario: 缺少密钥启动
- **WHEN** 服务端缺少任一对必需密钥启动
- **THEN** 健康检查仍可用,但登录 bootstrap 返回服务不可用错误且不下发任何密钥

### Requirement: 登录下发客户端 OSS 凭证
服务端 SHALL 在 bootstrap 校验账号口令成功后,向响应返回 `pdd-client` 的 AccessKeyId/AccessKeySecret、OSS 连接信息(bucket、region、endpoint、rootPrefix)与能力约束,供客户端在本次会话内直连 OSS。

#### Scenario: 登录成功下发凭证
- **WHEN** 客户端提交正确账号口令调用 bootstrap
- **THEN** 响应包含客户端 OSS AccessKey、OSS 连接信息与能力约束

#### Scenario: 登录失败不下发
- **WHEN** 账号不存在或口令错误
- **THEN** 响应为认证失败且不包含任何 OSS 密钥或连接信息

### Requirement: 不再签发 STS 临时凭证或 stsBroker
服务端 bootstrap 响应 MUST NOT 包含 STS 临时凭证(credentials/securityToken/expiration)或 stsBroker 字段;服务端 MUST NOT 调用 STS AssumeRole,且 MUST NOT 提供临时凭证刷新接口。

#### Scenario: 响应不含临时凭证
- **WHEN** 客户端调用 bootstrap 成功
- **THEN** 响应中不存在 credentials、securityToken、expiration、stsBroker 字段

#### Scenario: 无刷新接口
- **WHEN** 客户端请求原 `/api/v1/session/refresh` 路径
- **THEN** 服务端返回路由不存在,不再提供 STS 刷新

### Requirement: 服务端直连读写用户目录
服务端 SHALL 使用 `PDD_SERVER_OSS_*` 密钥直接对 OSS 对象 `config/users.json` 执行 GetObject/PutObject,用于登录校验与改密回写;MUST NOT 经由 STS 或客户端代读。

#### Scenario: 登录读取用户目录
- **WHEN** bootstrap 需要校验口令
- **THEN** 服务端以 `pdd-server` 密钥读取 `config/users.json` 并比对 scrypt 哈希

#### Scenario: 改密回写用户目录
- **WHEN** 用户改密成功
- **THEN** 服务端以 `pdd-server` 密钥将更新后的用户目录写回 `config/users.json`

### Requirement: 密钥秘密不泄露
服务端 MUST NOT 在日志、错误响应或健康检查中输出任何 AccessKeySecret;下发密钥仅出现在 bootstrap 成功响应体中且仅经 HTTPS 传输。

#### Scenario: 错误响应脱敏
- **WHEN** OSS 或下发过程发生错误
- **THEN** 错误响应与日志不包含 AccessKeySecret 明文
