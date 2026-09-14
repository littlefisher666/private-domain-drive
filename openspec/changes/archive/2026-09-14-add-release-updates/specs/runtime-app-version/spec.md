## ADDED Requirements

### Requirement: 读取运行时应用版本
客户端 SHALL 从当前已安装的 Android APK 或 macOS App Bundle 读取产品版本和构建号，作为当前运行版本的唯一来源。

#### Scenario: 正式构建版本展示
- **WHEN** CI 使用 `--build-name 1.2.0 --build-number 42` 构建应用
- **THEN** 客户端 SHALL 获得产品版本 `1.2.0` 与构建号 `42`

#### Scenario: 设置页显示版本
- **WHEN** 用户打开设置页
- **THEN** 页面 SHALL 显示当前运行的产品版本，且不得展示硬编码版本字符串

### Requirement: 统一使用产品版本
客户端 SHALL 使用当前运行的产品版本向 FC 请求传递 `appVersion`，并用于与静态更新清单中产品版本的语义化比较。

#### Scenario: 登录请求上报版本
- **WHEN** 用户发起登录
- **THEN** 请求中的 `appVersion` SHALL 等于当前运行的产品版本
