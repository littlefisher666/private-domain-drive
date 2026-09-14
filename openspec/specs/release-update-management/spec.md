## Purpose

定义非应用商店分发场景下，通过 GitHub Release 静态更新清单检查并交付客户端更新的规则。

## Requirements

### Requirement: 检查静态更新清单
客户端 SHALL 在用户从设置页发起检查时读取 GitHub Latest Release 中的 `private-domain-drive-update.json`，并只在清单产品版本高于当前版本且存在当前平台资产时提示更新。

#### Scenario: 发现当前平台的新版本
- **WHEN** 静态更新清单的版本高于当前版本且包含当前平台资产
- **THEN** 客户端 SHALL 展示远端版本与更新操作；清单未提供更新说明时 SHALL 展示“暂无更新说明”

#### Scenario: 当前已是最新版本
- **WHEN** 静态更新清单的版本不高于当前版本
- **THEN** 客户端 SHALL 提示已是最新版本

#### Scenario: 当前平台缺少资产
- **WHEN** 静态更新清单未包含当前平台要求的 `.apk` 或 `.dmg` 发布资产
- **THEN** 客户端 SHALL 不将该清单版本视为可更新版本

### Requirement: Android 安全安装 APK
客户端 SHALL 下载 Android APK 到应用专属临时目录，并在 SHA-256 与静态更新清单中的资产摘要一致后才调用系统安装器。

#### Scenario: APK 摘要校验成功
- **WHEN** 下载完成且计算出的 SHA-256 与静态更新清单的资产摘要一致
- **THEN** 客户端 SHALL 通过系统安装器请求安装该 APK

#### Scenario: APK 摘要校验失败
- **WHEN** 下载完成但计算出的 SHA-256 与静态更新清单的资产摘要不一致
- **THEN** 客户端 SHALL 删除临时 APK、报告校验失败且不得发起安装

### Requirement: macOS DMG 手动更新引导
客户端 SHALL 在 macOS 可用更新时打开对应 DMG 的下载地址，并向用户说明手动替换 App 的步骤。

#### Scenario: macOS 用户开始更新
- **WHEN** 用户在 macOS 更新提示中选择下载
- **THEN** 客户端 SHALL 打开 DMG 下载地址并展示将新版 App 拖入“应用程序”覆盖旧版的说明

### Requirement: 非调试构建不得预填登录凭证
客户端 SHALL 仅在 Debug 构建中使用本地构建配置提供的默认登录账号和口令。Profile 与 Release 构建不得在安装包中保留或在登录页预填这些值。

#### Scenario: Debug 本地联调
- **WHEN** Debug 构建通过 `DEBUG_DEFAULT_ACCOUNT` 与 `DEBUG_DEFAULT_PASSWORD` 注入值启动
- **THEN** 登录页 SHALL 使用注入值初始化对应输入框

#### Scenario: 发布包登录
- **WHEN** 用户启动 Profile 或 Release 构建
- **THEN** 登录页 SHALL 以空账号和空口令输入框启动
