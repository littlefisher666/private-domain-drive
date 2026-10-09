# release-update-management 规格增量

## MODIFIED Requirements

### Requirement: 检查静态更新清单
Android 客户端 SHALL 通过 GitHub Releases 列表接口查询发布记录，在 tag 匹配 `android/` 前缀的发布中选取版本号最高的一个（不依赖接口返回顺序），读取该 Release 附带的 `private-domain-drive-update.json`，并只在清单产品版本高于当前版本且存在 Android 资产时提示更新；macOS 客户端 SHALL NOT 再通过静态更新清单检查更新，其更新检查改由 Sparkle 能力承担。

#### Scenario: 发现当前平台的新版本
- **WHEN** Android 客户端检查更新，且 Android 版本号最高的 Release 清单版本高于当前版本并包含 Android 资产
- **THEN** 客户端 SHALL 展示远端版本与更新操作；清单未提供更新说明时 SHALL 展示“暂无更新说明”

#### Scenario: 当前已是最新版本
- **WHEN** Android 版本号最高的 Release 清单版本不高于当前版本
- **THEN** 客户端 SHALL 提示已是最新版本

#### Scenario: 另一端单独发版
- **WHEN** Android 版本号最高的 Release 版本不高于当前版本，而 macOS 存在版本号更高的 Release
- **THEN** 客户端 SHALL 不提示更新

#### Scenario: 当前平台缺少资产
- **WHEN** Android 版本号最高的 Release 清单未包含 `.apk` 发布资产
- **THEN** 客户端 SHALL 不将该清单版本视为可更新版本

#### Scenario: 不存在平台匹配的 Release
- **WHEN** Releases 列表中没有任何 tag 匹配 `android/` 前缀的发布记录
- **THEN** 客户端 SHALL 按已是最新版本静默处理并提示暂未发现本平台的发布版本，且不得报错中断

### Requirement: 更新检查交互反馈
Android 客户端 SHALL 在更新检查（手动或自动）发起时立即展示进行中状态（加载指示与"正在检查最新版本…"副标题），检查进行中 SHALL 忽略重复触发；检查失败时 SHALL 在设置页展示"网络不稳定，无法访问 GitHub"并 SHALL 提供用系统浏览器打开 GitHub Releases 页面的手动下载入口；macOS 客户端的检查中与失败反馈由 Sparkle 原生交互与手动下载兜底承担，SHALL NOT 复用该 Dart 侧状态机。

#### Scenario: 点击检查后立即反馈
- **WHEN** Android 用户点击"检查更新"或进入设置页触发自动检查
- **THEN** 客户端 SHALL 立即显示加载指示与"正在检查最新版本…"副标题，无需等待请求返回

#### Scenario: 检查进行中重复点击
- **WHEN** 更新检查进行中用户再次点击"检查更新"
- **THEN** 客户端 SHALL 忽略本次触发且不并发发起新的检查请求

#### Scenario: 检查失败提示与手动下载
- **WHEN** 更新检查请求失败或超时（含自动检查的静默失败路径）
- **THEN** 客户端 SHALL 展示"网络不稳定，无法访问 GitHub"，并提供"手动下载"入口，点击后 SHALL 用系统浏览器打开 GitHub Releases 页面；用户重新检查成功后 SHALL 清除失败状态

### Requirement: 更新检查请求超时
Android 客户端 SHALL 为更新检查的全部 GitHub 请求（发布列表与更新清单）设置 10 秒超时，超时 SHALL 按检查失败处理；macOS 端 appcast 拉取超时由 Sparkle 原生链路处理，SHALL NOT 使用该 Dart 侧超时配置。

#### Scenario: 请求超时按失败处理
- **WHEN** Android 端发布列表或更新清单请求超过 10 秒未返回
- **THEN** 客户端 SHALL 终止等待并按检查失败路径展示失败提示与手动下载入口，SHALL NOT 长时间挂起加载状态

### Requirement: 更新检查系统代理解析
Android 客户端 SHALL 在发起更新检查请求前通过平台通道读取 `ConnectivityManager` 默认代理；检测到代理时更新检查请求 SHALL 经该代理发出，未检测到或解析失败时 SHALL 静默直连。该代理 SHALL 仅作用于更新检查相关请求，SHALL NOT 影响业务接口与文件传输链路；macOS 端 Sparkle 原生请求链路 SHALL NOT 依赖该 Dart 侧代理解析。

#### Scenario: 系统配置代理时走代理
- **WHEN** Android 系统配置了可用的 HTTP/HTTPS 代理且客户端发起更新检查
- **THEN** 客户端 SHALL 经系统代理发出 GitHub 请求并记录所用代理

#### Scenario: 未配置代理或解析失败时直连
- **WHEN** Android 系统未配置代理、平台不支持代理解析或解析过程出错
- **THEN** 客户端 SHALL 静默降级为直连请求，不得报错中断，且 SHALL 保留环境变量代理（`http_proxy` 等）的既有能力

#### Scenario: 代理仅作用于更新检查
- **WHEN** Android 客户端检测到系统代理并用于更新检查
- **THEN** 登录鉴权、配置下发等业务接口请求与 OSS 文件直传 SHALL 不经由该代理配置

## REMOVED Requirements

### Requirement: macOS DMG 手动更新引导
**Reason**: macOS 更新主路径由 Sparkle App 内自更新替代（见 sparkle-auto-update 能力），不再以"下载 DMG + 手动替换"作为 macOS 默认更新流程。
**Migration**: 手动下载能力保留为自更新失败的兜底入口（macOS 设置页打开 GitHub Releases 页面），首次安装仍使用 DMG。
