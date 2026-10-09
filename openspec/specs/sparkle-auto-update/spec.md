## Purpose

定义 macOS 客户端基于 Sparkle 的 App 内自更新规则：appcast 检查、EdDSA 签名校验、原生弹窗安装交互与手动下载兜底。

## Requirements

### Requirement: macOS Sparkle 更新检查
macOS 客户端 SHALL 集成 Sparkle 自更新能力，从固定 appcast 地址拉取更新清单，并在版本号高于当前版本时向用户提示更新；客户端 SHALL 在启动后自动静默检查一次更新，并 SHALL 在设置页提供手动"检查更新"入口。

#### Scenario: 发现新版本
- **WHEN** appcast 中最新 item 的版本号高于当前版本且包含有效的 EdDSA 签名与下载地址
- **THEN** 客户端 SHALL 通过 Sparkle 展示新版本与更新确认弹窗，确认后开始下载更新包

#### Scenario: 当前已是最新版本
- **WHEN** appcast 中最新 item 的版本号不高于当前版本
- **THEN** 客户端 SHALL 不弹出更新提示；用户从设置页手动检查时 SHALL 得到已是最新版本的反馈

#### Scenario: 启动静默检查
- **WHEN** macOS 客户端完成启动
- **THEN** 客户端 SHALL 自动静默检查一次更新，无新版本或检查失败时 SHALL NOT 打扰用户

#### Scenario: 检查失败静默降级
- **WHEN** appcast 拉取失败、超时或内容无法解析
- **THEN** 自动检查 SHALL 静默忽略本次失败；设置页手动检查 SHALL 提示检查失败并展示手动下载入口

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
