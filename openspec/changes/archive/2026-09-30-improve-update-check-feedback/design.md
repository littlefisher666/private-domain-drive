# 设计：更新检查即时反馈、失败兜底与系统代理支持

## 背景约束

- 更新检查是客户端唯一不经服务端中转的外网请求（GitHub Releases），国内网络环境下直连成功率低，用户普遍依赖代理
- Dart `dart:io` 的 `HttpClient` 默认只读取 `http_proxy`/`https_proxy` 环境变量，不会读取 macOS 系统网络设置中的代理，也不会读取 Android 的 WiFi/全局 HTTP 代理
- 业务接口（FC 服务端）与 OSS 文件直传不需要代理，代理能力必须限定作用范围，避免影响其他链路

## 决策

### 1. 加载与失败状态收敛到 `SettingsPage` 单一状态源

复用既有的 `_checkingUpdate` 标志并新增 `_updateCheckFailed`，自动检查与手动检查共用同一状态；副标题与 trailing 均由状态派生：

- `_checkingUpdate` 为 true：转圈 + "正在检查最新版本…"（自动检查也同样展示）
- `_updateCheckFailed` 为 true："网络不稳定，无法访问 GitHub" + "手动下载"按钮
- 手动下载按钮调用 `launchUrl`（外部浏览器）打开 `GithubReleaseClient.releasesPageUrl`，浏览器自身会走系统代理，天然兜底

检查中忽略重复触发（防抖），失败状态在重新发起检查时清除。

### 2. 超时统一常量，作用于全部 GitHub 请求

`_requestTimeout = Duration(seconds: 10)`，发布列表与更新清单两个请求均 `.timeout()`；超时抛出 `TimeoutException`，与既有失败路径（SnackBar + 失败状态）自然汇合。取 10 秒的依据：远大于正常请求耗时，又能让被墙连接在用户可接受的等待范围内失败。

### 3. 系统代理解析按平台分发，失败一律静默降级

新增 `system_proxy.dart`，对外仅暴露 `resolveSystemProxy()`：

- macOS：`Process.run('scutil', ['--proxy'])` 解析输出，优先取 HTTPS 代理，其次 HTTP（去重），都没有时退回 SOCKS，拼成 `HttpClient.findProxy` 配置串
- Android：`MethodChannel('private_domain_drive/system_proxy')` 调用原生 `ConnectivityManager.getDefaultProxy()`（API 23+，低版本直接返回空）；PAC-only 代理（host 为空）视为无代理；`PlatformException` / `MissingPluginException` 静默返回 null
- 其他平台返回 null

`GithubReleaseClient` 改为惰性创建并缓存 `http.Client`：首次请求时解析一次系统代理，命中则用带 `findProxy` 的 `IOClient`，否则用默认客户端（保留环境变量代理能力）。注入式构造参数保留供测试。

### 4. 代理仅覆盖更新检查链路

`ApkDownloader` 不接代理：Android 应用内下载主要运行在 VPN/TUN 全局接管场景（无需感知代理）；macOS 走浏览器下载，浏览器自身处理代理。

## 风险

- `scutil --proxy` 依赖外部进程，理论上可能被安全软件拦截——已用 try/catch 兜底为直连
- 代理客户端按首次请求结果缓存，会话中修改系统代理需重启应用后生效——更新检查低频，可接受
- VPN/TUN 模式下 `getDefaultProxy()` 通常返回空，行为退化为直连（流量仍被 VPN 接管），与改造前一致
