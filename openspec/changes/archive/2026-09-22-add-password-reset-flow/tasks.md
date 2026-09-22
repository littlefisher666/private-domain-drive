## 1. 服务端用户目录与认证

- [x] 1.1 将 `config/users.json` 用户格式收敛为 account、scrypt 哈希 password、userId、可选 displayName 与 mustResetPassword，并移除角色依赖。
- [x] 1.2 实现 scrypt 密码哈希、恒定时间验证和无效哈希拒绝逻辑；补充单元测试。
- [x] 1.3 在 bootstrap 响应中返回 mustResetPassword，并确保登录成功时不返回密码哈希。

## 2. 服务端密码修改接口

- [x] 2.1 新增 `POST /api/v1/session/password` 路由与请求校验，校验 account、currentPassword 和至少 8 位的 newPassword。
- [x] 2.2 实现 OSS 用户目录读取、当前密码验证、密码哈希更新和 mustResetPassword 清除后的安全回写。
- [x] 2.3 为密码修改成功、当前密码错误、密码长度不足、OSS 读取/写入失败补充服务端测试。
- [x] 2.4 确认 FC 运行时 RAM 策略仅允许读取和写入 `config/users.json`，且客户端 STS 策略不包含该对象键。

## 3. 客户端会话与 API 集成

- [x] 3.1 在 UserSession、序列化和安全本地存储中保存 mustResetPassword，并兼容缺失字段的旧会话。
- [x] 3.2 在 ApiClient 与 SessionRepository 中解析 bootstrap 标记并封装密码修改请求。
- [x] 3.3 在 AppController 中实现改密调用、成功后的会话标记更新和安全存储回写。

## 4. 客户端强制改密体验

- [x] 4.1 增加改密路由和页面，提供当前密码、新密码、确认密码、长度与一致性校验及错误反馈。
- [x] 4.2 登录成功时若必须改密，导航至改密页而不是文件空间。
- [x] 4.3 冷启动恢复会话时若必须改密，导航至改密页而不是文件空间。
- [x] 4.4 改密成功后进入文件空间；请求失败时保留改密页且不得清除本地强制改密标记。

## 5. 文档与验证

- [x] 5.1 更新接口文档、技术文档和服务端 README，说明用户 JSON、哈希密码、改密接口和迁移步骤。
- [x] 5.2 运行服务端测试、客户端相关单元/组件测试、格式化和 OpenSpec 校验。
