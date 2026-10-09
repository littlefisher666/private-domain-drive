## Purpose

定义客户端发布流水线按平台拆分版本号、tag 与 Release 的规则，避免单端发版导致另一端版本号被动递增与误报更新。

## Requirements

### Requirement: 平台版本 tag 命名
发布流水线 SHALL 为每个平台维护独立的版本 tag 序列，格式为 `android/vX.Y.Z` 与 `macos/vX.Y.Z`，并 SHALL NOT 再创建共享的 `vX.Y.Z` 版本 tag。

#### Scenario: 首次发布无历史 tag
- **WHEN** 流水线启动且不存在对应平台的任何版本 tag
- **THEN** 流水线 SHALL 以 `1.0.0` 作为该平台当前版本

#### Scenario: 目标平台 tag 已存在
- **WHEN** 解析出的目标平台版本 tag 已存在
- **THEN** 流水线 SHALL 报错终止且不创建任何 Release

### Requirement: 发布平台选择输入
发布流水线 SHALL 提供 `platforms` 手动选择输入，取值为 `both`、`android`、`macos`，默认值为 `both`；流水线 SHALL 只构建、只递增版本并只为所选平台创建 Release。

#### Scenario: 默认触发全平台发布
- **WHEN** 触发流水线且未选择 `platforms`
- **THEN** 流水线 SHALL 等价于选择 `both`，构建两端并创建两个平台 Release

#### Scenario: 仅选择 Android
- **WHEN** 触发流水线且 `platforms` 选择 `android`
- **THEN** 流水线 SHALL 只递增并创建 `android/v*` tag、只构建 APK，且 SHALL NOT 递增 `macos` 版本、SHALL NOT 构建 DMG 或创建 macOS Release

### Requirement: 版本号按平台独立递增
发布流水线 SHALL 按所选平台各自最新的平台版本 tag 独立解析当前版本并自动递增 PATCH，不同平台版本不同步时 SHALL NOT 强制拉齐；用户手动填写 `version` 时，流水线 SHALL 将所选平台版本设为该值，未选平台 SHALL 不受影响。

#### Scenario: 两端版本不同步时自动递增
- **WHEN** `platforms` 为 `both`、`version` 留空，且 `android` 最新为 `1.2.4`、`macos` 最新为 `1.2.3`
- **THEN** 流水线 SHALL 发布 `android/v1.2.5` 与 `macos/v1.2.4`

#### Scenario: 手动指定版本
- **WHEN** `platforms` 为 `both` 且 `version` 填写 `2.0.0`
- **THEN** 流水线 SHALL 将两端版本均设为 `2.0.0` 并创建 `android/v2.0.0` 与 `macos/v2.0.0`

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

### Requirement: 发布说明范围与平台标注
发布流水线 SHALL 以"上一次同平台版本 tag 到本次"作为更新说明的 commit 范围，并在说明开头标注本次发布涉及的平台。

#### Scenario: 单端发布的说明范围
- **WHEN** 仅发布 Android，且 `android` 上一次 tag 为 `android/v1.2.4`
- **THEN** 更新说明 SHALL 只汇总 `android/v1.2.4` 到本次提交范围的变更，并标注本次仅涉及 Android
