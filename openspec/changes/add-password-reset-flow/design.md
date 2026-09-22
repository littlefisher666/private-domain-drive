## Context

一期不引入数据库，用户目录固定存放于 OSS 的 `config/users.json`，而 `shared/` 仅承载网盘可见内容。服务端需要读取该目录进行认证，并在密码修改后原子地更新同一对象。客户端通过 HTTPS 调用 FC；密码原文仅在请求中传输，由服务端验证哈希，客户端不得以哈希值替代密码提交。

## Goals / Non-Goals

**Goals:**

- 让 OSS 用户目录不再保存明文密码。
- 允许管理员通过 `mustResetPassword` 强制用户在首次登录后修改密码。
- 确保强制改密状态在客户端冷启动后仍不能绕过。
- 用同一份用户目录完成认证和密码状态更新。

**Non-Goals:**

- 不引入用户角色、细粒度用户权限、注册、找回密码或多因素认证。
- 不建立数据库、服务端 session、刷新 token 或用户管理后台。
- 不在客户端实现密码哈希或保存原始密码。

## Decisions

### 使用 `password` 字段保存 scrypt 哈希

用户 JSON 保持简洁，`password` 字段存放 `scrypt$<salt>$<derivedKey>` 格式的不可逆哈希；每次设置密码生成独立随机 salt，并使用恒定时间比较验证结果。采用 Node.js 内置 `crypto.scrypt`，避免为小型 FC 服务新增密码库依赖。明文 `password` 不兼容，以避免迁移期间继续保留弱存储路径。

### 由服务端完成哈希验证和 OSS 回写

客户端经 HTTPS 将当前密码和新密码传至 FC；服务端读取 `config/users.json`、校验当前密码、更新该用户的哈希和 `mustResetPassword: false`，再使用运行时 RAM 凭证回写 OSS。客户端哈希后提交会使哈希串成为可重放凭据，不能替代此设计。

### 强制改密作为持久化会话状态

bootstrap 将 `user.mustResetPassword` 返回给客户端，客户端把它与会话一同写入安全本地存储。登录成功和冷启动恢复会话后，状态为 `true` 时路由必须指向改密页；改密成功后才清除状态并允许进入文件空间。

### 以当前密码校验保护改密接口

新增 `POST /api/v1/session/password`，请求包含 account、currentPassword、newPassword。接口验证当前密码、校验新密码最小长度 8、写回 OSS 后返回成功。当前一期尚无服务端会话令牌，因此以账号和当前密码作为认证材料；接口与 bootstrap 一样由 FC 请求签名和 HTTPS 保护。

## Risks / Trade-offs

- [OSS 并发写入可能覆盖另一处用户目录修改] → 一期仅允许低频人工用户管理和密码改密；实现时使用 ETag/If-Match 或明确记录该限制，后续用户管理能力需引入并发控制。
- [旧明文目录无法登录] → 部署前离线生成每个用户的 scrypt 哈希并整体上传，发布前验证样例用户。
- [已缓存的旧客户端会话无法识别强制改密状态] → 服务端发布与客户端发布需协调；在此能力上线后，必要时清理旧客户端会话或让其重新登录。
- [使用密码作为接口认证材料无法支持无密码找回] → 本变更不包含找回密码，管理员需在 OSS 用户目录中设置新哈希并将标记置为 true。

## Migration Plan

1. 离线将现有用户明文密码转换为 scrypt 哈希，并在 `config/users.json` 中增加 `mustResetPassword`。
2. 为 FC 运行时 RAM 用户授予读取和写入 `config/users.json` 的最小 OSS 权限，不下发该路径给客户端 STS。
3. 部署服务端，再发布支持改密拦截的客户端。
4. 对需重置的账户设置 `mustResetPassword: true`；验证登录、改密、冷启动拦截和 OSS 回写。
5. 若需要回滚客户端，先将受影响账户的标记设为 false；服务端回滚前恢复兼容的用户目录格式或保留新认证实现。

## Open Questions

- 无。当前一期统一能力、不区分角色，密码重置由 OSS 用户目录的受控维护流程完成。
