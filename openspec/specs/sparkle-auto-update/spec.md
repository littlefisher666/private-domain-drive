## Purpose

定义 macOS 客户端基于 Sparkle 的 App 内自更新规则：appcast 检查、EdDSA 签名校验、原生弹窗安装交互与手动下载兜底。

## Requirements

### Requirement: macOS Sparkle 更新检查
macOS 客户端 SHALL 集成 Sparkle 自更新能力，从固定 appcast 地址拉取更新清单，并在版本号高于当前版本时向用户提示更新；客户端 SHALL 默认在启动后自动静默检查一次更新，SHALL 在设置页提供手动"检查更新"入口，并 SHALL 在设置页提供"启动时自动检查更新"开关（默认开启、本地持久化）。更新检查时机 SHALL 仅由应用显式发起：客户端 SHALL 通过 Info.plist 禁用 Sparkle 原生自动调度（`SUEnableAutomaticChecks` 为 `false`），Sparkle SHALL NOT 自行定时检查，也 SHALL NOT 弹出首次运行的"自动检查更新"系统授权弹窗。

#### Scenario: 发现新版本
- **WHEN** appcast 中最新 item 的版本号高于当前版本且包含有效的 EdDSA 签名与下载地址
- **THEN** 客户端 SHALL 通过 Sparkle 展示新版本与更新确认弹窗，确认后开始下载更新包

#### Scenario: 当前已是最新版本
- **WHEN** appcast 中最新 item 的版本号不高于当前版本
- **THEN** 客户端 SHALL 不弹出更新提示；用户从设置页手动检查时 SHALL 得到已是最新版本的反馈

#### Scenario: 启动静默检查
- **WHEN** macOS 客户端完成启动且"启动时自动检查更新"开关处于开启状态
- **THEN** 客户端 SHALL 自动静默检查一次更新，无新版本或检查失败时 SHALL NOT 打扰用户

#### Scenario: 启动检查被用户关闭
- **WHEN** 用户在设置页关闭"启动时自动检查更新"后重启应用
- **THEN** 客户端启动时 SHALL NOT 发起更新检查；设置页手动"检查更新"入口 SHALL 保持可用

#### Scenario: 检查失败静默降级
- **WHEN** appcast 拉取失败、超时或内容无法解析
- **THEN** 自动检查 SHALL 静默忽略本次失败；设置页手动检查 SHALL 提示检查失败并展示手动下载入口

### Requirement: 启动检查的调试环境开关
macOS 客户端 SHALL 支持通过编译期注入 `DISABLE_STARTUP_UPDATE_CHECK=true` 强制关闭启动自动检查；该配置生效时，设置页"启动时自动检查更新"开关 SHALL 显示为关闭且不可更改，并 SHALL 说明该状态来源于本地调试配置。未注入该配置的构建 SHALL NOT 受影响。

#### Scenario: 调试配置强制关闭启动检查
- **WHEN** 构建注入 `DISABLE_STARTUP_UPDATE_CHECK=true` 后启动 macOS 客户端
- **THEN** 客户端启动时 SHALL NOT 发起更新检查，设置页开关 SHALL 为关闭且置灰状态，副标题 SHALL 标明"本地调试配置已禁用启动检查"

#### Scenario: 正式构建不受调试配置影响
- **WHEN** 构建未注入 `DISABLE_STARTUP_UPDATE_CHECK`
- **THEN** 启动检查 SHALL 仅由设置页"启动时自动检查更新"开关决定，开关 SHALL 可正常切换并跨启动恢复

### Requirement: macOS EdDSA 校验与安装
macOS 客户端 SHALL 使用内置公钥对下载的更新包执行 Sparkle EdDSA 签名校验，校验通过后由 Sparkle 安装器完成替换并重启；校验失败时 SHALL NOT 执行安装。

#### Scenario: 更新包校验通过
- **WHEN** 更新包下载完成且 EdDSA 签名与 appcast 声明一致
- **THEN** Sparkle SHALL 用新版本替换当前 App 并重启进入新版本

#### Scenario: 更新包校验失败
- **WHEN** 更新包下载完成但 EdDSA 签名校验失败
- **THEN** 客户端 SHALL 终止安装、丢弃更新包并提示失败，SHALL NOT 重启进入新版本

### Requirement: macOS 手动下载兜底
macOS 客户端 SHALL 在更新检查失败时提供用系统浏览器打开 GitHub Releases 页面的手动下载入口，并 SHALL 在更新说明中包含手动替换 App 的引导。

#### Scenario: 自更新不可用时手动下载
- **WHEN** 用户在 macOS 设置页检查更新失败并选择"手动下载"
- **THEN** 客户端 SHALL 用系统浏览器打开 GitHub Releases 页面，用户按引导下载 DMG 手动安装

### Requirement: macOS 发布构建不得启用沙箱
macOS Release 构建产物 SHALL NOT 启用 App Sandbox（`com.apple.security.app-sandbox` 为 `false`），否则 Sparkle 无法替换应用。

#### Scenario: 发布构建沙箱校验
- **WHEN** 发布流水线产出 macOS App 包
- **THEN** App 包的 entitlements SHALL 为未启用 App Sandbox 状态，且本地文件访问、下载与预览链路经回归验证可用
