# macOS 客户端接入 Sparkle 实现 App 内自更新

## Why

macOS 端目前每次发版后，用户必须在设置页手动下载 DMG 并拖入“应用程序”覆盖旧版，更新成本高、易被跳过。接入 Sparkle 自更新框架后，已安装用户可在 App 内一键完成下载、校验、替换与重启，全程无需重新走 DMG 安装流程，也无需 Apple 开发者账号。

## What Changes

- macOS 客户端集成 `auto_updater`（Sparkle 2 封装），在设置页提供“检查更新”能力：发现新版本时下载更新包、校验 EdDSA 签名、提示重启安装
- 发布流水线 macOS 链路新增 Sparkle 更新包产出：将 `.app` 打成 zip 作为 Sparkle 更新载荷，与 DMG 一同上传至 GitHub Release
- 发布流水线新增 appcast 维护：每次 macOS 发版生成/合并 Sparkle 标准格式 `appcast.xml`（含 EdDSA 签名、版本号、下载地址、更新说明），发布到固定 URL
- 引入 EdDSA 签名体系（Sparkle `generate_keys` / `sign_update`）：私钥存入仓库 Secret，公钥内置于 App，作为无 Apple 开发者账号场景下的更新信任锚点
- **BREAKING** `macos/Runner/Release.entitlements` 关闭 App Sandbox（`com.apple.security.app-sandbox` 改为 `false`）：沙箱应用不允许 Sparkle 自更新，关闭后需验证本地文件访问、下载与预览链路不受影响
- `release-update-management` 中 macOS“DMG 手动更新引导”路径被 App 内自更新替代；DMG 保留用于首次安装，自更新失败时保留手动下载入口作为兜底

## Capabilities

### New Capabilities

- `sparkle-auto-update`: macOS 端基于 Sparkle 的 App 内自更新，覆盖 appcast 检查与版本比较、EdDSA 签名校验、更新下载与安装重启、首次安装引导与失败兜底

### Modified Capabilities

- `per-platform-release`: macOS Release 产物要求变化——除 DMG 外 SHALL 增加 Sparkle 更新包 zip，并维护 `appcast.xml` 清单（含 EdDSA 签名与更新说明）
- `release-update-management`: macOS 更新路径变化——由“下载 DMG + 手动替换”改为“App 内 Sparkle 自更新为主、手动下载 DMG 兜底”；更新检查交互、超时与代理解析要求在 macOS 端适配 Sparkle 检查链路

## Impact

- **客户端** `client/`：`pubspec.yaml` 新增 `auto_updater` 依赖；`macos/Runner/Info.plist` 写入 `SUPublicEDKey`；`macos/Runner/Release.entitlements` 关闭沙箱；设置页更新检查逻辑按平台分流（macOS 走 Sparkle，Android 维持现有清单下载安装）
- **发布流水线** `client/.github/workflows/release.yml`：macos job 新增 zip 打包与 `sign_update` 签名步骤；release job 新增 appcast 生成/合并与发布
- **仓库 Secret**：新增 `SPARKLE_EDDSA_PRIVATE_KEY`（EdDSA 私钥）
- **appcast 托管**：使用客户端仓库专用分支（如 `appcast`）托管 `appcast.xml`，客户端经固定 URL 拉取，无需服务端 FC/OSS 改动
- **文档**：归档后同步 `docs/技术文档.md`（更新分发机制）与首次安装引导说明
