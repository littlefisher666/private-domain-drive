## Why

服务端已将用户目录迁移至 OSS 的 `config/users.json`，并以密码哈希替代明文密码；但客户端尚未识别首次登录强制改密状态，也无法调用密码修改接口。该断层会使被标记为必须改密的用户仍可直接进入文件空间。

## What Changes

- 将 OSS 用户 JSON 的 `password` 定义为 scrypt 哈希值，并使用 `mustResetPassword` 标记是否必须修改密码。
- 服务端登录响应下发 `mustResetPassword`，并提供受当前密码校验保护的密码修改接口；修改后安全回写 OSS 用户目录并清除该标记。
- 客户端保存并恢复强制改密状态；状态为真时，登录及冷启动均只能进入改密页面，不能进入文件空间。
- 客户端提供当前密码、新密码和确认密码输入，并调用服务端接口完成改密。
- **BREAKING**：`config/users.json` 不再支持明文密码；原有用户数据需要迁移为 scrypt 哈希格式。

## Capabilities

### New Capabilities

- `password-reset-flow`: 基于 OSS 用户目录的哈希密码认证、首次强制改密和客户端访问拦截。

### Modified Capabilities

无。

## Impact

- 服务端：用户目录读取与回写、登录接口、密码修改接口、OSS 写入权限及测试。
- 客户端：会话模型与安全本地存储、FC API 客户端、登录/启动路由、改密页面及测试。
- 文档：接口契约、用户 JSON 格式、部署所需的 OSS 对象读写权限。
