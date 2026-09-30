## ADDED Requirements

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
