## 1. 服务端配置读取

- [x] 1.1 将 `server/src` config 层改为读取 `PDD_SERVER_OSS_ACCESS_KEY_ID/SECRET`、`PDD_OSS_BUCKET/REGION/ENDPOINT/ROOT_PREFIX` 及 `PDD_TEXT_PREVIEW_MAX_BYTES`、`PDD_MULTIPART_UPLOAD_THRESHOLD_BYTES`、`PDD_ALLOWED_PREVIEW_EXTENSIONS`
- [x] 1.2 新增读取 `PDD_CLIENT_OSS_ACCESS_KEY_ID/SECRET`（服务端保管、登录下发的 pdd-client 密钥）
- [x] 1.3 移除对 `ALIBABA_CLOUD_*`、`STS_*`、裸 `OSS_*` 变量的读取与默认凭证链依赖
- [x] 1.4 为缺失必填 `PDD_*` 变量提供启动期校验与清晰报错

## 2. 服务端 OSS 直连

- [x] 2.1 移除 `@alicloud/sts20150401` 依赖，引入 `ali-oss`
- [x] 2.2 用 `PDD_SERVER_OSS_*` 密钥构造 OSS 客户端，直连读写 `config/users.json`
- [x] 2.3 删除 `stsService`（AssumeRole 签发逻辑）及其调用点
- [x] 2.4 确保 OSS 客户端初始化失败时返回统一错误码，不泄露 AccessKeySecret

## 3. 服务端会话接口

- [x] 3.1 改造 bootstrap 处理器：校验口令成功后下发 pdd-client OSS AccessKey、OSS 连接信息（bucket/region/endpoint/rootPrefix）与能力约束
- [x] 3.2 从 bootstrap 响应移除 `credentials`/`stsBroker`/`securityToken` 等 STS 字段（BREAKING）
- [x] 3.3 删除 `/api/v1/session/refresh` 路由与处理器，保留 `bootstrap` 与 `password`
- [x] 3.4 确认下发密钥仅来自服务端环境变量，不落盘、不写日志

## 4. 服务端测试

- [x] 4.1 更新/新增 config 读取测试，覆盖 `PDD_*` 变量与缺失校验
- [x] 4.2 更新 bootstrap 测试：断言下发 pdd-client 密钥与 OSS 配置，且不含 STS 字段
- [x] 4.3 更新 ossService/users.json 读写测试为 ali-oss 直连
- [x] 4.4 删除或改写涉及 stsService/refresh 的测试
- [x] 4.5 运行 `server` 测试套件全部通过

## 5. 客户端会话与认证

- [x] 5.1 认证/会话层解析新 bootstrap 响应，接收 OSS 连接信息与 pdd-client 长期 AccessKey
- [x] 5.2 会话内以内存持有下发密钥，退出登录时清除；移除 stsBroker 缓存
- [x] 5.3 移除凭证刷新链路（不再调用 refresh，不再自助 AssumeRole）
- [x] 5.4 冷启动无会话时引导重新登录（不落盘密钥）
- [x] 5.5 鉴权失败时引导重新登录，而非触发刷新

## 6. 客户端原生 OSS 桥接

- [x] 6.1 Android OSS 适配器去掉 SecurityToken 参数，改用长期 AccessKey 签名配置
- [x] 6.2 macOS OSS 适配器去掉 SecurityToken 参数，改用长期 AccessKey 签名配置
- [x] 6.3 平台通道方法参数与配置结构同步移除临时凭证字段
- [x] 6.4 确认错误信息与日志不含 AccessKeySecret
- [x] 6.5 缩略图与图片详情预览请求使用下发密钥，失败仍降级为默认图标/错误态

## 7. 客户端测试与联调

- [x] 7.1 更新会话/认证层单元测试覆盖新 bootstrap 结构与退出清除
- [x] 7.2 更新原生桥接相关测试/契约，移除 SecurityToken
- [x] 7.3 `flutter analyze` 与 `flutter test` 通过
- [x] 7.4 用 `env/local.json` 注入配置，macOS 与 Android 各跑一次登录→浏览→缩略图→上传/下载联调

## 8. 文档同步

- [x] 8.1 更新 `docs/技术文档.md`：认证模型改为双 AKSK 直连、登录下发密钥、移除 STS
- [x] 8.2 更新接口文档：bootstrap 响应新字段、删除 refresh 接口（标注 BREAKING）
- [x] 8.3 更新 `AGENTS.md` 中「已确认的凭证架构取舍」段落为双 AKSK 直连
- [x] 8.4 校对 `docs/阿里云资源与部署配置.md` 与最终代码变量名一致

## 9. 发布

- [x] 9.1 服务端与客户端同批发布（bootstrap 响应 BREAKING）
- [x] 9.2 预发环境联调通过后再上线（STS 角色已删除，无法回滚到 STS）
- [x] 9.3 配置 server 仓库 8 个 GitHub Secrets 与 client 仓库 `FC_*` Secrets/`FC_BASE_URL` 变量
- [ ] 9.4 上线后删除临时密钥清单文件（`docs/ram用户.csv`、`github_secrets.csv`）
