# Spec Delta

## MODIFIED Requirements

### Requirement: 按平台拆分发布产物

每个平台 Release SHALL 只包含该平台的发布资产与清单：Android Release SHALL 包含 `private-domain-drive-android-vX.Y.Z.apk`，macOS Release SHALL 包含 `private-domain-drive-macos-vX.Y.Z.dmg` 与 Sparkle 更新包 `private-domain-drive-macos-vX.Y.Z.zip`；各 Release 附带的 `private-domain-drive-update.json` SHALL 包含 `version`（该平台版本）、该平台一个资产字段与 `minSupportedVersion`（最低支持版本，缺省或为空表示不限制）。GitHub Release SHALL 继续挂载原始资产作归档与手动下载兜底；清单中资产的下载地址 SHALL 指向 OSS 发布镜像直链，镜像不可用时回退 GitHub Release 下载地址。

#### Scenario: Android Release 清单结构

- **WHEN** Android 平台 Release 创建完成
- **THEN** 其 update.json 的 `assets` SHALL 仅含 `android` 字段，且 `version` 等于该平台 tag 的版本号，资产 `url` SHALL 为 OSS 镜像直链或回退的 GitHub Release 下载地址

#### Scenario: macOS Release 资产结构

- **WHEN** macOS 平台 Release 创建完成
- **THEN** 该 Release SHALL 同时挂载 DMG（首次安装用）与 zip（Sparkle 更新载荷），zip SHALL 由 `.app` 以保留扩展属性与签名元数据的方式打包

#### Scenario: 两端同时发布

- **WHEN** `platforms` 为 `both` 且构建成功
- **THEN** 流水线 SHALL 创建两个独立的 Release（tag 分别为 `android/vX.Y.Z` 与 `macos/vX.Y.Z`），各自只挂载本平台资产与清单

#### Scenario: 清单包含最低支持版本字段

- **WHEN** 平台 Release 创建完成
- **THEN** 其 update.json SHALL 包含 `minSupportedVersion` 字段，值等于发布时确定的最低支持版本；无可用值（未提供输入且无历史值可沿用）时该字段 SHALL 为空值或缺省

## ADDED Requirements

### Requirement: 最低支持版本发布输入

发布流水线 SHALL 提供 `force_update`（本次升级强制）与 `min_supported_version`（显式最低支持版本，允许 `v` 前缀）输入，决定本次各平台清单的最低支持版本：`force_update` 为是时该平台 SHALL 取本次发布版本；提供 `min_supported_version` 时 SHALL 取该值；两者都未提供时 SHALL 沿用上一版同平台清单的 `minSupportedVersion`，无历史值则为空；两者同时提供且值不一致时流水线 SHALL 报错终止。两端 SHALL 按各自平台版本独立取值。

#### Scenario: 本次强制升级

- **WHEN** `force_update` 为是，Android 本次发布版本为 1.5.0
- **THEN** Android 清单的 `minSupportedVersion` SHALL 为 1.5.0

#### Scenario: 显式门槛

- **WHEN** `min_supported_version` 为 1.4.0，本次发布版本为 1.6.0
- **THEN** 本次清单的 `minSupportedVersion` SHALL 为 1.4.0，本次升级对 1.4.0 及以上用户为可选

#### Scenario: 沿用上一版并平台独立

- **WHEN** 两个输入都未提供，且上一版 Android 清单 `minSupportedVersion` 为 1.4.0、macOS 清单为空
- **THEN** 本次 Android 清单 SHALL 沿用 1.4.0，macOS 清单 SHALL 为空

#### Scenario: 输入冲突报错

- **WHEN** `force_update` 为是且 `min_supported_version` 指定了一个与本次发布版本不同的值
- **THEN** 流水线 SHALL 报错终止且不创建 Release

### Requirement: 最低支持版本校验

发布流水线 SHALL 在生成清单前校验确定后的最低支持版本为合法版本号（`X.Y.Z`，允许 `v` 前缀）且不高于本次平台发布版本；校验失败 SHALL 报错终止且不创建 Release。

#### Scenario: 门槛高于本次发布版本

- **WHEN** 确定的最低支持版本为 2.0.0，而本次平台发布版本为 1.6.0
- **THEN** 流水线 SHALL 报错终止且不创建 Release，避免用户升级后仍低于门槛

#### Scenario: 格式非法

- **WHEN** `min_supported_version` 输入不符合 `X.Y.Z` 格式（例如 `1.6`）
- **THEN** 流水线 SHALL 报错终止且不创建 Release
