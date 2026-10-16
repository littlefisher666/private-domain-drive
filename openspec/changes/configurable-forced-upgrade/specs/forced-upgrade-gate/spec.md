# Spec Delta

## Purpose

定义客户端基于「最低支持版本」策略的强制升级门禁：启动静默检查本平台更新清单的最低支持版本，低于门槛时以不可跳过的全屏界面拦截应用使用，直至完成升级或主动退出。

## ADDED Requirements

### Requirement: 最低支持版本判定

客户端 SHALL 将当前运行产品版本与本平台更新清单中的 `minSupportedVersion`（最低支持版本）做语义化比较（忽略构建号）；当前版本低于最低支持版本时判定为强制升级。清单缺失该字段、值为空或无法解析时 SHALL 不判定强制升级（视为不限制）。

#### Scenario: 低于最低支持版本

- **WHEN** 启动静默检查成功返回本平台清单，最低支持版本为 1.2.0，当前运行版本为 1.1.4
- **THEN** 客户端 SHALL 判定为强制升级并进入强制升级拦截

#### Scenario: 不低于最低支持版本

- **WHEN** 当前运行版本为 1.2.0 或更高，清单最低支持版本为 1.2.0
- **THEN** 客户端 SHALL NOT 判定强制升级，应用按现有流程正常使用

#### Scenario: 清单缺省最低支持版本

- **WHEN** 清单不包含 `minSupportedVersion` 字段或值为空
- **THEN** 客户端 SHALL 按无限制处理且 SHALL NOT 拦截

### Requirement: 启动静默检查

Android 与 macOS 客户端 SHALL 在应用启动后发起一次静默的清单检查，用于最低支持版本判定；该检查 SHALL NOT 阻塞启动渲染与路由推进，也 SHALL NOT 依赖登录会话。检查失败（网络不可达、超时、响应异常）SHALL 静默放行且 SHALL NOT 缓存拦截结论，下次启动重新检查。该检查 SHALL NOT 与设置页更新检查的进行中、失败展示状态互相影响。

#### Scenario: 启动检查不阻塞

- **WHEN** 应用启动
- **THEN** 启动页与后续登录、主页路由 SHALL 正常推进，静默检查在后台进行；仅当判定为强制升级时才改变界面

#### Scenario: 检查失败放行

- **WHEN** 启动静默检查因离线、超时或响应异常失败
- **THEN** 客户端 SHALL 允许正常使用、SHALL NOT 展示拦截界面，并 SHALL 在下一次启动时重新检查

#### Scenario: 检查完成后判定为强制

- **WHEN** 后台静默检查成功完成且当前版本低于最低支持版本
- **THEN** 客户端 SHALL 以强制升级界面替代整个应用界面

#### Scenario: 未登录会话同样受到门禁

- **WHEN** 应用冷启动恢复本地会话或尚未登录，且静默检查判定为强制升级
- **THEN** 客户端 SHALL 同样进入强制升级拦截，SHALL NOT 要求先登录

### Requirement: 强制升级拦截界面

判定为强制升级时，客户端 SHALL 以不可跳过的全屏界面替代整个应用界面，展示当前版本、最低支持版本与升级引导；界面 SHALL NOT 提供关闭、跳过或稍后操作，返回操作 SHALL NOT 绕过拦截。界面 SHALL 提供「立即升级」主操作、「重试」与「退出应用」；重新检查成功且不再满足强制条件时 SHALL 解除拦截并恢复正常界面。

#### Scenario: 拦截界面不可跳过

- **WHEN** 强制升级判定生效
- **THEN** 应用 SHALL 只展示拦截界面，SHALL NOT 展示登录、主页、设置等任何其他页面，且返回操作 SHALL NOT 退出拦截

#### Scenario: Android 立即升级

- **WHEN** 用户在拦截界面点击「立即升级」且当前平台为 Android
- **THEN** 客户端 SHALL 下载更新包、在 SHA-256 与清单摘要一致后发起系统安装

#### Scenario: macOS 立即升级

- **WHEN** 用户在拦截界面点击「立即升级」且当前平台为 macOS
- **THEN** 客户端 SHALL 触发 Sparkle 更新检查与安装交互，安装完成后以新版本重启

#### Scenario: 升级动作失败兜底

- **WHEN** 立即升级过程中下载、校验或安装发起失败
- **THEN** 界面 SHALL 展示失败信息与重试入口，并 SHALL 提供「手动下载」以系统浏览器打开 Releases 页面

#### Scenario: 重试后解除拦截

- **WHEN** 用户点击「重试」且重新检查成功、判定不再满足强制条件
- **THEN** 客户端 SHALL 解除拦截并恢复被替换前的正常界面

### Requirement: 门禁检查与开关关系

强制升级门禁的启动检查 SHALL 独立于 macOS「启动时自动检查更新」用户开关，关闭该开关 SHALL NOT 豁免门禁检查；编译期注入 `DISABLE_STARTUP_UPDATE_CHECK=true` 时客户端 SHALL 跳过启动检查（含门禁检查），该配置 SHALL 仅用于本地调试构建。

#### Scenario: 关闭自动检查不豁免门禁

- **WHEN** macOS 用户关闭「启动时自动检查更新」后启动应用，且清单判定为强制升级
- **THEN** 客户端 SHALL 仍然进入强制升级拦截

#### Scenario: 调试开关跳过启动检查

- **WHEN** 构建注入 `DISABLE_STARTUP_UPDATE_CHECK=true` 后启动客户端
- **THEN** 客户端 SHALL NOT 发起启动静默检查，也 SHALL NOT 进入强制升级拦截，设置页手动检查不受影响
