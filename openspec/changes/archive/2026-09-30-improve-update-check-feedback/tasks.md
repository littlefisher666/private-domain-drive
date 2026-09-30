# 任务

## 1. 交互反馈与失败兜底

- [x] 1.1 `settings_page.dart`：手动检查 `_checkForUpdate` 设置 `_checkingUpdate`，失败路径设置 `_updateCheckFailed`，`finally` 恢复状态；检查中忽略重复点击
- [x] 1.2 副标题与 trailing 状态化：检查中显示转圈 + "正在检查最新版本…"（自动检查同样生效）；失败显示"网络不稳定，无法访问 GitHub" + "手动下载"按钮；成功恢复版本信息
- [x] 1.3 新增 `_openReleasesPage`：外部浏览器打开 `GithubReleaseClient.releasesPageUrl`，打不开时 SnackBar 兜底
- [x] 1.4 自动检查失败（原静默路径）同步进入失败状态展示

## 2. 请求超时与系统代理解析

- [x] 2.1 `github_release_client.dart`：新增 `_requestTimeout = Duration(seconds: 10)`，发布列表与更新清单请求均应用 `.timeout()`
- [x] 2.2 新增 `system_proxy.dart`：`resolveSystemProxy()` 按平台分发；macOS 解析 `scutil --proxy`（HTTPS > HTTP 去重 > SOCKS）；其他平台返回 null；全程异常静默降级
- [x] 2.3 `MainActivity.kt`：新增 `private_domain_drive/system_proxy` 平台通道，`getDefaultProxy` 经 `ConnectivityManager.getDefaultProxy()` 返回 host/port（API 23+ 版本判断、PAC-only 返回空）
- [x] 2.4 `system_proxy.dart` Android 分支接入平台通道并处理 `PlatformException`/`MissingPluginException`
- [x] 2.5 `GithubReleaseClient` 惰性创建并缓存代理客户端（命中代理用 `IOClient` + `findProxy`，未命中保持默认直连），日志输出"使用系统代理"
- [x] 2.6 `flutter analyze` 无告警；`./gradlew :app:compileDebugKotlin` 编译通过

## 3. 真机验证

- [x] 3.1 macOS：点击检查立即转圈；`scutil --proxy` 有系统代理时日志输出 `使用系统代理：PROXY 127.0.0.1:7890` 且检查流程走通
- [x] 3.2 Android 真机（VPN 模式、零配置）：检查更新成功返回远端版本与 APK 资产，下载完成 SHA-256 校验通过、缓存复用生效、安装流程触发
- [x] 3.3 Android 真机（adb 注入全局 HTTP 代理）：日志确认读到 `PROXY 10.195.31.143:7890`（代理读取链路验证，端到端转发受本机 Clash Allow LAN 限制属环境问题）

## 4. 归档

- [x] 4.1 delta 规格同步至 `openspec/specs/release-update-management/spec.md`
