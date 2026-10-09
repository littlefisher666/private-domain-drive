# design: macOS Sparkle 自更新

## Context

macOS 端当前通过 `release-update-management` 能力做更新：设置页检查 GitHub Releases 清单（`private-domain-drive-update.json`），发现新版本后引导用户手动下载 DMG 替换 App。该流程每次发版都需要用户重复安装操作。

发布流水线（`client/.github/workflows/release.yml`）已实现按平台独立发版：macos job 构建未签名（ad-hoc）App 并打成 DMG，release job 生成更新清单并创建 `macos/vX.Y.Z` Release。macOS Release.entitlements 当前开启 App Sandbox。

本变更引入 Sparkle 2 自更新，不依赖 Apple 开发者账号。

## Goals / Non-Goals

**Goals:**

- macOS 已安装用户可在 App 内完成"检查更新 → 下载 → 校验 → 重启安装"全流程
- 复用现有 GitHub Actions 发布链路与 GitHub Release 托管，不引入 FC/OSS 服务端改动
- 无 Apple 开发者账号场景下保证更新包可信（EdDSA 签名）
- 保留手动下载 DMG 作为更新失败兜底

**Non-Goals:**

- 不做 Sparkle delta 增量更新（包体积小，全量 zip 足够）
- 不申请 Apple Developer ID、不做公证、不上架 Mac App Store
- 不改动 Android 更新路径与服务端任何接口
- 不支持从 DMG 以外方式（如 Homebrew Cask）分发

## Decisions

### D1. 更新框架：Sparkle 2（经 `auto_updater` Flutter 插件）

- `auto_updater` 是 Flutter 生态对 Sparkle 2 的成熟封装，提供初始化（feedURL + 公钥）、检查更新、重启安装的标准 API
- 备选：Squirrel.Mac（Electron 系、生态弱、独立集成成本高）；自研"下载 zip + 替换 /Applications"（需自行处理校验、替换失败回滚，风险与维护成本高）
- Sparkle 是 macOS 直分发事实标准，安装器经 XPC 服务替换 App，不触发 Gatekeeper

### D2. 信任锚点：EdDSA 签名，不依赖 Apple 证书

- 一次性用 Sparkle `generate_keys` 生成密钥对；私钥存仓库 Secret `SPARKLE_EDDSA_PRIVATE_KEY`，公钥以 `SUPublicEDKey` 写入 `macos/Runner/Info.plist`
- 每次发版用 `sign_update` 对 zip 签名，签名串写入 appcast item
- App 本体维持 ad-hoc 签名（Flutter/Xcode 默认），Sparkle 对无 Developer ID 的应用以 EdDSA 为唯一信任锚；构建方式保持统一以保证版本间 code signing 状态一致

### D3. 更新包：zip（`ditto -c -k --keepParent`），DMG 保留用于首次安装

- Sparkle 官方推荐 zip：解包即 `.app` 本体，处理链路最短；DMG 需挂载镜像，边界问题多
- DMG 继续作为 Release 资产与首次安装引导的下载物；zip 仅作为 Sparkle 更新载荷
- 用 `ditto` 打包以保留扩展属性与签名元数据，不用普通 `zip` 命令

### D4. appcast 托管：client 仓库专用分支（`appcast`）+ 固定 raw URL

- 每次 macOS 发版：从 `appcast` 分支读取现有 `appcast.xml`，插入新 item（版本号、zip 下载 URL 指向 GitHub Release asset、EdDSA 签名、文件长度、更新说明链接），推回该分支
- 客户端拉取固定 URL：`https://raw.githubusercontent.com/littlefisher666/private-domain-drive-client/appcast/appcast.xml`
- 备选：appcast 作为 Release asset（URL 每版变化，客户端无从发现首版地址）；OSS（需开公开读权限，与私有桶策略冲突，且引入服务端依赖）
- 历史 item 全部保留，天然支持跨版本升级；首次生成时以当前最新 Release 作为种子 item

### D5. 客户端集成：平台分流，macOS 走 Sparkle

- 设置页"检查更新"入口复用；macOS 端改为调用 Sparkle 检查（`auto_updater` 的 `checkForUpdates`），Android 端维持现有清单下载安装链路不动
- macOS 启动后静默检查一次（Sparkle 自带间隔控制），设置页保留手动检查与手动下载 DMG 兜底入口
- 现有"系统代理解析仅作用于更新检查"机制不覆盖 Sparkle：Sparkle 在原生层自行发请求，Dart 侧代理配置无法注入；国内直连 raw.githubusercontent 不稳定时依赖系统 VPN 或兜底手动下载，作为已知取舍
- 更新交互直接使用 Sparkle 原生弹窗（含版本号与更新说明），不再自绘 macOS 更新 UI；现有"检查中/失败提示"等 Dart 侧状态仅保留 Android 与手动下载入口

### D6. 关闭 App Sandbox

- `macos/Runner/Release.entitlements` 将 `com.apple.security.app-sandbox` 改为 `false`，Debug/Profile 同步调整保持一致
- 沙箱应用禁止 Sparkle 自更新（安装器无法替换 `/Applications`），此为本方案硬前提
- 关闭后需回归验证：下载目录写入、用户选定文件读写、图片/视频预览与本地缓存路径均不依赖沙箱授予；私域网盘需要广泛本地文件访问，非沙箱本就是更合理的权限模型

## Risks / Trade-offs

- [EdDSA 私钥丢失后无法签发被存量版本信任的更新] → 私钥同时存于 GitHub Secret 与本地备份（如系统钥匙串），在 docs/ 中记录备份要求；一旦丢失需引导全体用户重新手动安装
- [ad-hoc 签名状态在版本间不一致会导致 Sparkle 拒绝更新] → 更新包与 App 一律由同一条流水线、同一构建方式产出，禁止本地构建产物混入发布链路
- [国内直连 raw.githubusercontent / GitHub Release 下载不稳定] → 保留手动下载 DMG 兜底入口；用户侧 VPN 仍为可用路径；此为 GitHub 托管既有取舍，不因本变更恶化
- [关闭沙箱影响既有文件权限行为] → 实施时对下载、预览、缓存、分享导入等链路做回归验证；entitlements 中其余权限项保留
- [存量旧版本用户无 Sparkle，无法被自更新触达] → 可接受：本期上线后首个 Sparkle 版本仍需最后一次手动安装，之后所有版本走自更新
- [首次安装仍被 Gatekeeper 拦截（无公证）] → 首次安装引导文档写明右键打开/系统设置"仍要打开"/`xattr -cr` 操作方式

## Migration Plan

1. 生成 EdDSA 密钥对，私钥配置 GitHub Secret，公钥写入 Info.plist，本地验证 Debug 构建可发起 Sparkle 检查
2. 流水线改造：macos job 增加 zip 打包与签名，release job 增加 appcast 生成/合并；先用测试版本（如 `macos/vX.Y.0+sparkle-test`）演练全链路
3. 发布首个带 Sparkle 的正式版本：appcast 以该版本为种子；此后用户升级该版本需手动安装一次
4. 后续发版自动走新链路；`release-update-management` 的 macOS 手动引导降级为兜底
5. 回滚策略：流水线步骤独立可跳过（zip/appcast 失败时不阻塞 DMG 发布，仅该版本无自更新能力）；客户端侧 Sparkle 检查失败静默降级到手动入口

## Open Questions

- 无。方案取舍已在 D1–D6 中确定。
