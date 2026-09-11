## ADDED Requirements

### Requirement: 检查稳定版 GitHub Release
客户端 SHALL 在用户从设置页发起检查时读取配置仓库的 GitHub Latest Release，并只在远端产品版本高于当前版本且存在当前平台资产时提示更新。

#### Scenario: 发现当前平台的新版本
- **WHEN** Latest Release 的 tag 对应版本高于当前版本且包含当前平台资产
- **THEN** 客户端 SHALL 展示远端版本、发布说明与更新操作

#### Scenario: 当前已是最新版本
- **WHEN** Latest Release 的版本不高于当前版本
- **THEN** 客户端 SHALL 提示已是最新版本

#### Scenario: 当前平台缺少资产
- **WHEN** Latest Release 未包含当前平台要求的发布资产
- **THEN** 客户端 SHALL 不将该 Release 视为可更新版本

### Requirement: Android 安全安装 APK
客户端 SHALL 下载 Android APK 到应用专属临时目录，并在 SHA-256 与 GitHub Release 资产摘要一致后才调用系统安装器。

#### Scenario: APK 摘要校验成功
- **WHEN** 下载完成且计算出的 SHA-256 与 Release 资产摘要一致
- **THEN** 客户端 SHALL 通过系统安装器请求安装该 APK

#### Scenario: APK 摘要校验失败
- **WHEN** 下载完成但计算出的 SHA-256 与 Release 资产摘要不一致
- **THEN** 客户端 SHALL 删除临时 APK、报告校验失败且不得发起安装

### Requirement: macOS DMG 手动更新引导
客户端 SHALL 在 macOS 可用更新时打开对应 DMG 的下载地址，并向用户说明手动替换 App 的步骤。

#### Scenario: macOS 用户开始更新
- **WHEN** 用户在 macOS 更新提示中选择下载
- **THEN** 客户端 SHALL 打开 DMG 下载地址并展示将新版 App 拖入“应用程序”覆盖旧版的说明
