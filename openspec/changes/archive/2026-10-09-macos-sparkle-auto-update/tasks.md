# tasks: macOS Sparkle 自更新

## 1. 密钥与客户端基础设施准备

- [x] 1.1 本地安装 Sparkle 工具链（brew install sparkle 或下载官方 tarball），用 `generate_keys` 生成 EdDSA 密钥对；私钥导入本地钥匙串备份并配置到客户端仓库 Secret `SPARKLE_EDDSA_PRIVATE_KEY`，记录公钥
- [x] 1.2 将 EdDSA 公钥以 `SUPublicEDKey` 写入 `client/macos/Runner/Info.plist`
- [x] 1.3 将 `client/macos/Runner/Release.entitlements` 的 `com.apple.security.app-sandbox` 改为 `false`，并同步检查 Debug/Profile entitlements 保持一致；回归验证下载目录写入、用户选定文件读写、图片/视频预览与本地缓存链路
- [x] 1.4 `client/pubspec.yaml` 新增 `auto_updater` 依赖并 `flutter pub get`

## 2. macOS 客户端更新逻辑

- [x] 2.1 在 macOS 基础设施适配层封装 Sparkle 更新服务：初始化 appcast feed URL 与检查入口，启动后静默检查一次，暴露手动检查与结果回调
- [x] 2.2 设置页更新入口按平台分流：macOS 调用 Sparkle 手动检查（原生弹窗交互），Android 维持现有静态清单检查与 APK 安装链路不变
- [x] 2.3 macOS 更新检查失败时在设置页展示失败提示与"手动下载"入口（系统浏览器打开 GitHub Releases 页面），更新说明中包含手动替换 App 的引导文案
- [x] 2.4 编写/调整单元测试：平台分流逻辑、macOS 更新服务状态机（检查中/失败/最新）的 Dart 侧可测部分

## 3. 发布流水线改造（client/.github/workflows/release.yml）

- [x] 3.1 macos job 新增步骤：以 `ditto -c -k --keepParent` 将 `.app` 打成 `private-domain-drive-macos-vX.Y.Z.zip` 更新包
- [x] 3.2 macos job 新增签名步骤：安装 Sparkle 工具，用 `sign_update` 与 Secret `SPARKLE_EDDSA_PRIVATE_KEY` 对 zip 签名，输出 EdDSA 签名串与文件长度；签名失败时按设计降级（该版本仅发布 DMG，不阻塞流水线）
- [x] 3.3 release job 新增 appcast 维护步骤：从 `appcast` 分支读取现有 `appcast.xml`，合并新 item（版本号、Release 下载地址、EdDSA 签名、文件长度、更新说明链接），推回 `appcast` 分支；首次运行时以当前最新 macOS Release 为种子生成完整 appcast
- [x] 3.4 release job 将 zip 与 DMG 一同挂载到 macOS Release assets，更新 update.json 生成逻辑不受影响
- [x] 3.5 流水线整体演练：以测试版本号触发 workflow，验证 Release 资产齐全、`appcast` 分支 appcast 内容正确、EdDSA 签名可用 `sign_update --verify` 类方式校验通过

## 4. 端到端验证

- [x] 4.1 用演练版本构造"有新版本"场景：旧版（带 Sparkle）检查到新版，确认下载、EdDSA 校验通过、替换重启进入新版（macos/v1.0.3 → v1.0.5 实测通过）
- [x] 4.2 验证失败路径：篡改 appcast 签名后确认安装被拒绝（实测弹"此更新未正确签名"，日志确认 EdDSA 签名解码失败）；断网手动检查确认降级为"网络不稳定"提示与"手动下载"入口
- [x] 4.3 验证已是最新版本时静默检查不打扰用户、手动检查反馈正确（实测"You're up to date!"弹窗）；Android 端更新链路无代码改动，以代码回归确认分流逻辑单测覆盖

## 5. 文档与收尾

- [x] 5.1 更新首次安装引导文档：macOS 15+ Gatekeeper 放行操作（系统设置"仍要打开"/`xattr -cr`）与 EdDSA 私钥备份要求
- [x] 5.2 同步 `docs/技术文档.md` 更新分发机制章节（Sparkle 自更新架构、appcast 托管、签名体系）
- [x] 5.3 子仓库提交（client/）并在主仓库更新 submodule 指针，走 OpenSpec 归档流程
