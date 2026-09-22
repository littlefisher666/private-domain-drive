## Why

当前认证链路依赖 STS `AssumeRole` 签发临时凭证并经 `stsBroker` 由客户端自助刷新,链路长、配置项多、排查成本高。项目已确认改为更简单的双 AKSK 直连模式:服务端保管两对长期 RAM AccessKey,登录时把客户端 OSS 密钥下发,客户端会话内直连 OSS。配置层(环境变量 `PDD_*`、CI、Secrets)已先行完成,现在需要把服务端与客户端代码对齐到该模式。

## What Changes

- 服务端 `bootstrap` 在校验口令后,向响应中加入客户端 OSS AccessKey(`pdd-client`)与 OSS 连接信息(bucket/region/endpoint/rootPrefix)、能力约束;**BREAKING**:响应不再包含 STS 临时凭证与 `stsBroker`。
- 服务端移除 STS `AssumeRole` 签发逻辑与 `stsService` 的 broker/临时凭证职责;改为用 `pdd-server` 密钥直连 OSS 读写 `config/users.json`,并保管 `pdd-client` 密钥用于登录下发。
- 移除 `/api/v1/session/refresh` 的 STS 刷新语义(客户端持长期密钥,无需服务端刷新)。
- 客户端 OSS 适配器改用登录下发的 AccessKey 直连 OSS;**BREAKING**:移除 stsBroker 缓存、AssumeRole 自助刷新与凭证过期自动刷新逻辑。
- 客户端仅在会话内存中持有下发密钥,退出登录清除;不内置、不持久化 OSS 密钥。
- 服务端/客户端读取的环境变量与构建注入统一为 `PDD_*` 命名(配置层已完成,代码读取需对齐)。
- 同步 `docs/接口.md`、`docs/技术文档.md` 中凭证与 bootstrap 响应描述。

## Capabilities

### New Capabilities
- `session-credential-delivery`: 服务端登录 bootstrap 校验口令后,下发客户端 OSS AccessKey、OSS 连接信息与能力约束;服务端保管 `pdd-server`/`pdd-client` 两对密钥;不再签发 STS 临时凭证或 stsBroker。

### Modified Capabilities
- `native-oss-storage`: OSS 凭证来源由「STS 临时凭证 + 刷新」改为「登录下发的长期 AccessKey,会话内持有」;移除刷新要求,保留退出清除与秘密不落日志的要求。
- `oss-image-thumbnails`: 缩略图与图片预览复用会话内下发的 AccessKey,不再依赖 STS 临时凭证及其刷新失败路径。

## Impact

- 服务端:`src/config/*`(读取 `PDD_*`)、`src/services/stsService.js`(移除/重写)、`src/services/ossService.js`(改用 `pdd-server` 直连)、`src/handlers/sessionBootstrap.js` / `sessionRefresh.js`、`src/routes/index.js`、`test/*`。
- 客户端:Dart 会话/认证层、OSS 平台桥接(Android Kotlin / macOS Swift)凭证注入与清除逻辑、stsBroker 相关代码删除。
- 配置(已完成):`server/.env`、`.env.example`、`s.yaml`、`deploy-fc.yml`、`client/env/local.json`、`client/.github/workflows/release.yml`、GitHub Secrets。
- 文档:`docs/接口.md`、`docs/技术文档.md`、`docs/阿里云资源与部署配置.md`。
- 依赖:服务端可移除 `@alicloud/sts20150401`;需引入/确认 OSS Node SDK 用于读写 `config/users.json`。
