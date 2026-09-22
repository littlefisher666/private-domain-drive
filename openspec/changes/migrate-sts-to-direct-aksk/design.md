## Context

服务端当前通过 `stsService` 调 STS `AssumeRole` 签发临时凭证,并把 `stsBroker`(含受限 AK 与 policy)随 bootstrap 下发,客户端缓存 broker 后自助 AssumeRole 刷新。配置层已完成迁移:环境变量统一为 `PDD_*`,服务端 `.env`/`s.yaml`/CI 与客户端 `local.json`/`release.yml` 均已对齐;阿里云侧已建好 `pdd-server`、`pdd-client`、`pdd-fc-deploy`、`pdd-fc-invoke` 四个 RAM 用户与 `pdd-fc-role` 角色。现在需要把服务端与客户端代码切到双 AKSK 直连。

## Goals / Non-Goals

**Goals:**
- 服务端 bootstrap 校验口令后下发 `pdd-client` 的 OSS AccessKey 与 OSS 连接信息、能力约束。
- 服务端用 `pdd-server` 密钥直连 OSS 读写 `config/users.json`,不再 AssumeRole。
- 客户端会话内使用下发密钥直连 OSS,退出登录清除;移除 stsBroker 与刷新链路。
- 服务端/客户端代码读取的变量名与配置层 `PDD_*` 对齐。

**Non-Goals:**
- 不引入服务端会话 token / 服务端刷新机制。
- 不调整 OSS 权限范围(`shared/` 前缀、`config/users.json`)。
- 不重命名客户端 `FC_*` 构建注入键(留待后续)。
- 不建设用户角色/权限后台。
- 不做下发密钥的本地持久化(重启即重新登录)。

## Decisions

1. **客户端 OSS 密钥由服务端保管、登录下发**,而非构建期内置。
   - 理由:用户确认的方案;避免长期密钥烧进安装包被静态提取。
   - 备选:构建期 `--dart-define` 内置(已否决,密钥进二进制);保留 STS(已否决,链路复杂)。
2. **服务端用显式 `PDD_SERVER_OSS_*` 读配置直连 OSS**,不依赖 SDK 默认凭证链或 FC 执行角色。
   - 理由:命名已统一为 `PDD_*`,默认链读的是 `ALIBABA_CLOUD_*`,会读不到;显式读取可控、可测。
   - 备选:FC 执行角色凭证(已否决,用户要求显式 AKSK)。
3. **移除 `/api/v1/session/refresh` 的 STS 刷新语义**。客户端持长期密钥无需刷新;该路由删除,保留 `bootstrap` 与 `password`。
   - 备选:保留为 no-op(已否决,避免留下无意义接口)。
4. **下发密钥不落盘、仅存内存**。客户端重启/冷启动需重新登录换取密钥。
   - 理由:长期密钥持久化到设备风险高;一期接受重新登录的体验代价。
   - 备选:加密持久化(已否决,一期不做密钥保管基础设施)。
5. **原生 OSS 桥接层去掉 SecurityToken 参数**,以永久 AccessKey 签名;保留「秘密不进日志/错误信息」与退出清除要求。
6. **服务端移除 `@alicloud/sts20150401` 依赖**,引入 OSS Node SDK(ali-oss)读写 `config/users.json`。

## Risks / Trade-offs

- [长期密钥经登录响应传输] → 仅允许 HTTPS FC 端点;密钥权限锁 `shared/`;泄露时可单独轮换 `pdd-client` AK。
- [密钥在客户端内存可被提取] → 会话级持有、退出清除;权限最小化;必要时从 `pdd-client-oss` 移除 `oss:DeleteObject`。
- [客户端重启需重新登录] → 已接受的产品取舍,写入 spec 与文档。
- [服务端成为客户端密钥的保管点] → 经 GitHub Secrets + FC 环境变量管理,不入库;`.env` 已 gitignore。
- [BREAKING:bootstrap 响应结构变化] → 服务端与客户端需同批发布;旧客户端依赖 `credentials`/`stsBroker` 字段将失效。

## Migration Plan

1. 配置层(已完成):`PDD_*` 环境变量、CI、Secrets、阿里云 RAM 资源。
2. 服务端改造:config 读 `PDD_*`、ossService 直连、bootstrap 下发密钥、删除 refresh 与 stsService、更新测试。
3. 客户端改造:会话/认证层接收下发密钥、原生桥接去 SecurityToken、删除 stsBroker/刷新。
4. 文档同步:`docs/接口.md`、`docs/技术文档.md`。
5. 发布:服务端与客户端同批上线(响应结构 BREAKING)。
6. 回滚:因 STS 角色已删除,无法回滚到 STS;回滚=回退到上一版服务端+客户端组合(两者都还走旧字段),故发布前必须在预发联调通过。

## Open Questions

- 客户端冷启动重新登录的引导文案是否需要产品确认。
- 是否在后续为 `pdd-client` 去掉 `oss:DeleteObject`(回收站功能依赖删除,需权衡)。
