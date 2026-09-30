# 提案：更新检查即时反馈、失败兜底与系统代理支持

## Why

检查更新存在三类体验与可用性问题：手动点击"检查更新"后没有任何加载状态（网络慢时用户无法区分"没点到"还是"在请求"）；自动检查失败完全静默，页面长期停留在初始副标题，用户不知道是网络原因；GitHub 请求没有超时，国内直连 `api.github.com` 被卡住时会长时间挂起。此外国内用户普遍通过代理访问 GitHub，而 Dart `HttpClient` 不会自动读取 macOS 系统代理与 Android 系统代理（WiFi HTTP 代理），代理场景下更新检查仍会直连失败。

## What Changes

- 点击"检查更新"立即进入加载状态：右侧显示转圈、副标题显示"正在检查最新版本…"，自动检查（进入设置页时）同样展示；检查进行中忽略重复触发
- 检查失败不再静默：副标题显示"网络不稳定，无法访问 GitHub"，并提供"手动下载"入口，点击用系统浏览器打开 GitHub Releases 页面；手动检查失败同时保留原有 SnackBar 提示
- GitHub 请求（发布列表 + 更新清单）增加 10 秒超时，超时按检查失败处理
- 新增系统代理解析：macOS 执行 `scutil --proxy` 解析 HTTP/HTTPS/SOCKS 系统代理；Android 通过新增的 `private_domain_drive/system_proxy` 平台通道读取 `ConnectivityManager.getDefaultProxy()`；检测到代理时更新检查请求走代理，未检测到时直连（此时 `HttpClient` 自身仍读取 `http_proxy` 等环境变量）；代理解析失败一律静默降级为直连。代理仅作用于更新检查这条外网链路，不影响业务接口与文件直传流量

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `release-update-management`: 新增更新检查交互反馈、请求超时与系统代理解析三个需求，明确检查中/失败/代理降级的各场景行为

## Impact

- 客户端：
  - `client/lib/features/settings/presentation/settings_page.dart`（加载状态、失败状态、手动下载入口）
  - `client/lib/features/settings/infrastructure/github_release_client.dart`（请求超时、代理客户端惰性创建与缓存）
  - `client/lib/features/settings/infrastructure/system_proxy.dart`（新增：macOS/Android 系统代理解析）
  - `client/android/app/src/main/kotlin/com/github/littlefisher666/private_domain_drive/MainActivity.kt`（新增 system_proxy 平台通道）
- 规格同步：`openspec/specs/release-update-management/spec.md`
- 不涉及服务端、接口契约与发布流水线
