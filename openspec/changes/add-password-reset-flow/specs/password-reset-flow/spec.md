## ADDED Requirements

### Requirement: OSS 用户目录使用哈希密码
系统 SHALL 从固定 OSS 对象 `config/users.json` 读取用户目录，且该对象不得位于 `shared/` 可见文件前缀下。每个有效用户 MUST 包含 `account`、`password` 和 `userId`；其中 `password` MUST 是 scrypt 编码的不可逆哈希。用户可选包含 `displayName` 和布尔值 `mustResetPassword`，缺失该标记时系统 MUST 将其视为 `false`。

#### Scenario: 哈希密码登录成功
- **WHEN** 客户端以正确账号和原始密码调用 bootstrap
- **THEN** 服务端 MUST 使用 scrypt 验证 `password` 字段并返回该用户会话信息

#### Scenario: 用户目录包含明文密码
- **WHEN** 用户目录中 `password` 不是有效 scrypt 哈希
- **THEN** 服务端 MUST 不将其作为有效凭据，并且该用户登录 MUST 失败

### Requirement: 服务端下发强制改密状态
bootstrap 成功响应中的 `user` MUST 包含 `mustResetPassword`。该值 MUST 与 OSS 用户目录对应用户的标记一致，且系统不得依赖用户角色进行权限或改密判断。

#### Scenario: 账户被标记为必须改密
- **WHEN** 有效用户的 `mustResetPassword` 为 true
- **THEN** bootstrap 响应 MUST 返回 `user.mustResetPassword: true`

### Requirement: 用户可修改密码并清除重置标记
系统 SHALL 提供 `POST /api/v1/session/password`。请求 MUST 包含 `account`、`currentPassword` 和 `newPassword`；服务端 MUST 验证当前密码、新密码至少 8 个字符，并将新 scrypt 哈希与 `mustResetPassword: false` 回写至 `config/users.json`。响应和错误 MUST 使用既有统一信封。

#### Scenario: 强制改密成功
- **WHEN** 用户提交正确当前密码及长度不少于 8 个字符的新密码
- **THEN** 服务端 MUST 写入新的密码哈希、将 `mustResetPassword` 更新为 false，并返回成功

#### Scenario: 当前密码错误
- **WHEN** 用户提交错误的当前密码
- **THEN** 服务端 MUST 返回 `401 UNAUTHORIZED`，且不得修改 OSS 用户目录

#### Scenario: 新密码长度不足
- **WHEN** 用户提交少于 8 个字符的新密码
- **THEN** 服务端 MUST 返回 `400 BAD_REQUEST`，且不得修改 OSS 用户目录

### Requirement: 客户端强制改密访问拦截
客户端 MUST 将 bootstrap 返回的 `mustResetPassword` 与会话一起持久化到安全本地存储。当已登录会话的该值为 true 时，登录成功后的导航和冷启动会话恢复 MUST 进入改密页面，且不得进入文件空间。

#### Scenario: 登录后必须改密
- **WHEN** bootstrap 返回 `mustResetPassword: true`
- **THEN** 客户端 MUST 显示改密页面而非文件空间

#### Scenario: 冷启动恢复待改密会话
- **WHEN** 客户端恢复的安全本地会话标记为必须改密
- **THEN** 客户端 MUST 直接显示改密页面而非文件空间

### Requirement: 客户端改密界面与状态更新
客户端改密页面 MUST 收集当前密码、新密码和确认密码，必须在本地拒绝两次新密码不一致或少于 8 个字符的输入。成功调用密码修改接口后，客户端 MUST 将已保存会话的 `mustResetPassword` 更新为 false，并进入文件空间；失败时 MUST 留在改密页面并展示可理解的错误。

#### Scenario: 客户端改密成功
- **WHEN** 用户在改密页面提交有效输入且服务端返回成功
- **THEN** 客户端 MUST 清除本地强制改密状态并导航到文件空间

#### Scenario: 客户端改密失败
- **WHEN** 服务端拒绝当前密码或网络请求失败
- **THEN** 客户端 MUST 保持在改密页面并显示失败原因
