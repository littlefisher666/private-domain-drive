# Spec Delta

## MODIFIED Requirements

### Requirement: macOS Sparkle 更新检查
macOS 客户端 SHALL 集成 Sparkle 自更新能力；发起检查前客户端 SHALL 优先探测 OSS 发布目录固定路径 `releases/macos/appcast.xml`（探测超时 5 秒），探测通过时 SHALL 以 OSS 地址作为本次检查的 Sparkle feed，探测失败（网络错误、超时、状态码非 200）时 SHALL 回退以 GitHub appcast 地址作为 feed；并在版本号高于当前版本时向用户提示更新；客户端 SHALL 默认在启动后自动静默检查一次更新，SHALL 在设置页提供手动"检查更新"入口，并 SHALL 在设置页提供"启动时自动检查更新"开关（默认开启、本地持久化）。更新检查时机 SHALL 仅由应用显式发起：客户端 SHALL 通过 Info.plist 禁用 Sparkle 原生自动调度（`SUEnableAutomaticChecks` 为 `false`），Sparkle SHALL NOT 自行定时检查，也 SHALL NOT 弹出首次运行的"自动检查更新"系统授权弹窗。

#### Scenario: OSS feed 优先
- **WHEN** OSS appcast 探测通过
- **THEN** 客户端 SHALL 以 OSS 地址作为本次检查的 Sparkle feed 发起更新检查

#### Scenario: OSS feed 不可用时回退 GitHub
- **WHEN** OSS appcast 探测超时、状态码非 200 或网络错误
- **THEN** 客户端 SHALL 回退以 GitHub appcast 地址完成本次检查，SHALL NOT 仅因 OSS 探测失败直接判定检查失败

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
