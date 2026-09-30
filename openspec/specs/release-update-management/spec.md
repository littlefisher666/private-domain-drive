## Purpose

定义非应用商店分发场景下，通过 GitHub Release 静态更新清单检查并交付客户端更新的规则。

## Requirements

### Requirement: 检查静态更新清单
客户端 SHALL 通过 GitHub Releases 列表接口查询发布记录，在 tag 匹配当前平台前缀（`android/` 或 `macos/`）的发布中选取版本号最高的一个（不依赖接口返回顺序），读取该 Release 附带的 `private-domain-drive-update.json`，并只在清单产品版本高于当前版本且存在当前平台资产时提示更新。

#### Scenario: 发现当前平台的新版本
- **WHEN** 当前平台版本号最高的 Release 清单版本高于当前版本且包含当前平台资产
- **THEN** 客户端 SHALL 展示远端版本与更新操作；清单未提供更新说明时 SHALL 展示“暂无更新说明”

#### Scenario: 当前已是最新版本
- **WHEN** 当前平台版本号最高的 Release 清单版本不高于当前版本
- **THEN** 客户端 SHALL 提示已是最新版本

#### Scenario: 另一端单独发版
- **WHEN** 当前平台版本号最高的 Release 版本不高于当前版本，而其他平台存在版本号更高的 Release
- **THEN** 客户端 SHALL 不提示更新

#### Scenario: 当前平台缺少资产
- **WHEN** 当前平台版本号最高的 Release 清单未包含当前平台要求的 `.apk` 或 `.dmg` 发布资产
- **THEN** 客户端 SHALL 不将该清单版本视为可更新版本

#### Scenario: 不存在平台匹配的 Release
- **WHEN** Releases 列表中没有任何 tag 匹配当前平台前缀的发布记录
- **THEN** 客户端 SHALL 按已是最新版本静默处理并提示暂未发现本平台的发布版本，且不得报错中断

### Requirement: 更新检查交互反馈
客户端 SHALL 在更新检查（手动或自动）发起时立即展示进行中状态（加载指示与"正在检查最新版本…"副标题），检查进行中 SHALL 忽略重复触发；检查失败时 SHALL 在设置页展示"网络不稳定，无法访问 GitHub"并 SHALL 提供用系统浏览器打开 GitHub Releases 页面的手动下载入口。

#### Scenario: 点击检查后立即反馈
- **WHEN** 用户点击"检查更新"或进入设置页触发自动检查
- **THEN** 客户端 SHALL 立即显示加载指示与"正在检查最新版本…"副标题，无需等待请求返回

#### Scenario: 检查进行中重复点击
- **WHEN** 更新检查进行中用户再次点击"检查更新"
- **THEN** 客户端 SHALL 忽略本次触发且不并发发起新的检查请求

#### Scenario: 检查失败提示与手动下载
- **WHEN** 更新检查请求失败或超时（含自动检查的静默失败路径）
- **THEN** 客户端 SHALL 展示"网络不稳定，无法访问 GitHub"，并提供"手动下载"入口，点击后 SHALL 用系统浏览器打开 GitHub Releases 页面；用户重新检查成功后 SHALL 清除失败状态

### Requirement: 更新检查请求超时
客户端 SHALL 为更新检查的全部 GitHub 请求（发布列表与更新清单）设置 10 秒超时，超时 SHALL 按检查失败处理。

#### Scenario: 请求超时按失败处理
- **WHEN** 发布列表或更新清单请求超过 10 秒未返回
- **THEN** 客户端 SHALL 终止等待并按检查失败路径展示失败提示与手动下载入口，SHALL NOT 长时间挂起加载状态

### Requirement: 更新检查系统代理解析
客户端 SHALL 在发起更新检查请求前解析平台系统级代理：macOS SHALL 读取系统网络设置中的 HTTP/HTTPS（优先）/SOCKS 代理，Android SHALL 通过平台通道读取 `ConnectivityManager` 默认代理；检测到代理时更新检查请求 SHALL 经该代理发出，未检测到或解析失败时 SHALL 静默直连。该代理 SHALL 仅作用于更新检查相关请求，SHALL NOT 影响业务接口与文件传输链路。

#### Scenario: 系统配置代理时走代理
- **WHEN** 操作系统配置了可用的 HTTP/HTTPS 代理且客户端发起更新检查
- **THEN** 客户端 SHALL 经系统代理发出 GitHub 请求并记录所用代理

#### Scenario: 未配置代理或解析失败时直连
- **WHEN** 系统未配置代理、平台不支持代理解析或解析过程出错
- **THEN** 客户端 SHALL 静默降级为直连请求，不得报错中断，且 SHALL 保留环境变量代理（`http_proxy` 等）的既有能力

#### Scenario: 代理仅作用于更新检查
- **WHEN** 客户端检测到系统代理并用于更新检查
- **THEN** 登录鉴权、配置下发等业务接口请求与 OSS 文件直传 SHALL 不经由该代理配置

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
