## Context

客户端以 GitHub Releases 进行非应用商店分发。发布工作流生成 APK、macOS DMG 及随 Release 一同发布的静态更新清单，但客户端没有更新检查能力，设置页与 FC 请求使用硬编码版本。Android 可以在用户确认后安装同签名的新 APK；macOS 因无法提供 Developer ID 签名和公证，不能可靠地在应用内替换自身。

## Goals / Non-Goals

**Goals:**

- 从已安装包读取一个可比较、可展示的运行版本。
- 以 GitHub Latest Release 随附的公开静态更新清单为稳定版更新元数据源，并选择当前平台的发布资产。
- 在 Android 下载、SHA-256 校验并发起系统安装流程。
- 在 macOS 打开 DMG 下载地址并展示手动安装说明。
- 发布 macOS DMG，且 Android Release 使用正式签名配置。

**Non-Goals:**

- 不支持私有 GitHub 仓库、嵌入 GitHub 访问令牌或通过 FC 代理更新。
- 不支持 Android 静默安装。
- 不在未签名、未公证的 macOS 上实现自替换安装或绕过 Gatekeeper。
- 不实现增量包、断点续传、预发布通道或后台自动检查。

## Decisions

### 运行版本由 `package_info_plus` 提供

启动时读取平台安装包中的产品版本和构建号，并作为应用作用域依赖注入。`version`（例如 `1.2.0`）用于界面、FC 请求和 Release tag 的语义化比较；`buildNumber` 用于 Android 覆盖安装序列，界面默认不展示。保留 `pubspec.yaml` 默认版本供本地构建，CI 的 `--build-name`、`--build-number` 覆盖到安装包。

替代方案是在构建时使用 `--dart-define` 写入版本；该方案会复制版本来源且容易遗漏设置页或 API 请求，故不采用。

### 读取 GitHub Latest Release 的静态更新清单

发布工作流为每个正式 Release 生成 `private-domain-drive-update.json`，并通过 `releases/latest/download/private-domain-drive-update.json` 提供客户端读取。清单包含产品版本、可选更新说明和 Android/macOS 资产的名称、下载地址与 SHA-256 摘要；当前发布工作流写入空更新说明，客户端展示“暂无更新说明”。客户端将清单中的版本与当前运行版本进行 SemVer 比较，并按当前平台选择 `.apk` 或 `.dmg` 资产。

发布工作流与安装包在同一次 Release 中生成清单，避免客户端依赖 GitHub Release API 的响应结构；代价是发布时必须确保清单作为 Release 资产一并上传。APK 下载完成后必须与清单中的 SHA-256 摘要校验一致，才允许安装。

### 安装流程按平台隔离

Flutter 层负责检测状态、版本信息、Release Note 和界面；平台层负责交付动作。Android 将 APK 下载到应用专属临时目录，通过 FileProvider 和系统 package installer 发起安装，并在未知来源安装不可用时引导用户前往对应系统设置。macOS 不下载或替换 App，只使用系统浏览器打开 DMG URL，并明确提示拖入“应用程序”覆盖旧 App。

### 手动检查入口优先

更新检查由设置页“检查更新”触发，避免启动阻塞、GitHub 未认证 API 限流与后台行为复杂度。可用更新时展示可选更新弹窗；本次范围不引入最低版本/强制更新字段。

### 登录预填仅限调试构建

登录页不保存任何默认账号或口令字面量。仅当 Flutter 处于 `kDebugMode` 时，才读取 `DEBUG_DEFAULT_ACCOUNT` 与 `DEBUG_DEFAULT_PASSWORD` 两个 `dart-define`；两个值由不提交的 `env/local.json` 供本地调试注入。profile 和 release 构建即使意外传入这两个 define，也始终以空输入框启动。

这样保留本地联调的便利性，同时避免生产安装包包含演示账号或访问口令。

## Risks / Trade-offs

- [静态更新清单缺失、格式错误或网络不可用] → 检查失败不影响正常使用，向用户展示可重试的简短错误。
- [Release 未同步上传清单或平台资产] → 发布工作流统一生成并上传清单；客户端无可用平台资产时不提示可更新。
- [APK 下载被篡改或中断] → 必须匹配更新清单提供的 SHA-256，失败后删除临时文件且不发起安装。
- [Android 签名证书变更] → 发布文档和 CI 配置要求使用同一正式签名证书；系统会拒绝不同证书的覆盖安装。
- [未签名 macOS App 被 Gatekeeper 拦截] → 保持人工安装路径，明确提示 Finder 的确认操作，不绕过系统保护。

## Migration Plan

1. 合并客户端更新能力与发布工作流改动。
2. 在 GitHub 配置 Android keystore 与对应 Secrets 后，手动发布一个更高的版本。
3. 在 Android 真机验证同证书覆盖安装、在 macOS 验证 DMG 下载和手动替换指引。
4. 确认 APK、DMG 与 `private-domain-drive-update.json` 均已上传至 Release；若发布异常，删除或标记对应 GitHub Release，旧版本不受更新检查失败影响。

## Open Questions

- 无；当前范围不包含强制更新或预发布通道。
