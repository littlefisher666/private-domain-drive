# per-platform-release 规格增量

## MODIFIED Requirements

### Requirement: 按平台拆分发布产物
每个平台 Release SHALL 只包含该平台的发布资产与清单：Android Release SHALL 包含 `private-domain-drive-android-vX.Y.Z.apk`，macOS Release SHALL 包含 `private-domain-drive-macos-vX.Y.Z.dmg` 与 Sparkle 更新包 `private-domain-drive-macos-vX.Y.Z.zip`；各 Release 附带的 `private-domain-drive-update.json` SHALL 仅包含 `version`（该平台版本）与该平台一个资产字段。

#### Scenario: Android Release 清单结构
- **WHEN** Android 平台 Release 创建完成
- **THEN** 其 update.json 的 `assets` SHALL 仅含 `android` 字段，且 `version` 等于该平台 tag 的版本号

#### Scenario: macOS Release 资产结构
- **WHEN** macOS 平台 Release 创建完成
- **THEN** 该 Release SHALL 同时挂载 DMG（首次安装用）与 zip（Sparkle 更新载荷），zip SHALL 由 `.app` 以保留扩展属性与签名元数据的方式打包

#### Scenario: 两端同时发布
- **WHEN** `platforms` 为 `both` 且构建成功
- **THEN** 流水线 SHALL 创建两个独立的 Release（tag 分别为 `android/vX.Y.Z` 与 `macos/vX.Y.Z`），各自只挂载本平台资产与清单

## ADDED Requirements

### Requirement: macOS appcast 维护
发布流水线 SHALL 在每次 macOS 发版时用 Sparkle `sign_update` 以 EdDSA 私钥对更新包 zip 签名，并将新 item（版本号、zip 下载地址、EdDSA 签名、文件长度、更新说明）合并进托管于客户端仓库 `appcast` 分支固定路径的 `appcast.xml`；appcast SHALL 保留全部历史 item 以支持跨版本升级，EdDSA 私钥 SHALL 仅存在于仓库 Secret 与本地备份，SHALL NOT 写入源码或提交仓库。

#### Scenario: 发版生成新 item
- **WHEN** macOS Release 创建成功
- **THEN** 流水线 SHALL 以本次 zip 资产的 Release 下载地址、EdDSA 签名与版本号生成新 item，合并进 `appcast.xml` 并推送到 `appcast` 分支

#### Scenario: 历史 item 保留
- **WHEN** 本次发版合并新 item
- **THEN** `appcast.xml` SHALL 保留此前全部 item，旧版本客户端 SHALL 能沿 appcast 链路升级到最新版本

#### Scenario: 签名步骤失败不阻塞 DMG 发布
- **WHEN** zip 打包或 `sign_update` 签名在流水线中失败
- **THEN** 流水线 SHALL 允许本次 Release 仅以 DMG 完成（该版本不具备自更新触达能力），SHALL NOT 因 Sparkle 产物失败丢弃 DMG 发布
