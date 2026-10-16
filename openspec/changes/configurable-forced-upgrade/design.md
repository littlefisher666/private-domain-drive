# Design

## Context

见 proposal.md「Why」。设计相关的现状约束：

- 现有更新链路：Android 由 `client/lib/features/settings/application/update_service.dart` 读取 GitHub Latest Release 附带的 `private-domain-drive-update.json`（经 `github_release_client.dart` 拉取，10 秒超时、Android 走系统代理）；macOS 由 Sparkle 从 appcast 检查与安装（`macos_sparkle_updater.dart`）。macOS 与 Android 均已具备语义化版本比较（`core/version/app_version.dart`）。
- 更新清单由发布流水线按平台生成（`client/.github/workflows/release.yml` 的「生成平台更新清单」步骤，jq 构造，每个平台 Release 各挂一份）。
- 归档设计（2026-09-14 add-release-updates）此前明确排除强制更新；本次变更将其引入，并把 macOS 对清单的使用限定为门禁判定（更新交付仍走 Sparkle）。
- 启动链路：`main()` → `AppBootstrap.initialize()`（本地恢复会话，不请求服务端）→ `runApp` → Splash 350ms 后按登录态分流；macOS 在 `main.dart` 中已有一个不阻塞的 Sparkle 静默检查先例。
- 本地开发构建使用 `pubspec.yaml` 的固定版本 `0.0.1+1`（CI 用 `--build-name/--build-number` 覆盖），因此任何真实的最低支持版本都会把本地构建判定为强制升级，需要调试开关兜底。
- 本项目无服务端改动：FC 不参与版本策略，判定完全由发布产物（清单）与客户端完成。

## Goals / Non-Goals

**Goals:**

- 发布时通过流水线输入声明「本次强制 / 本次可选 / 门槛值」，并防止可选发布意外抹掉已有门槛。
- 客户端在启动后以不阻塞、失败无感的方式完成最低支持版本判定，并在判定为强制时提供结构上不可跳过的拦截。
- 升级动作完全复用现有链路（Android 应用内下载安装、macOS Sparkle），不新增分发通道。

**Non-Goals:**

- 不引入服务端版本策略接口或登录时校验（判定只发生在启动静默检查）。
- 不做运行中（不重启）的策略变更生效、定时轮询或后台复查。
- 不改动可选升级的既有交互（Android 设置页弹窗、macOS Sparkle 弹窗与开关）。
- 不处理降级安装、预发布通道、按系统版本区分的策略。

## Decisions

### 用「最低支持版本」字段表达强制/可选，而非布尔开关

清单新增 `minSupportedVersion`（可选字符串）。「本次强制」等价于把门槛设为本次版本；「本次可选」等价于门槛不变或低于本次版本。相比每版本一个 `force` 布尔值：单字段即可同时表达「强制」与「门槛低于最新版本」两种策略，且发布流水线可以让可选发布自动沿用上一版门槛而不回退保护；布尔开关无法表达「不强制升到最新、但至少要升到 X」。

### 门槛的持续化与校验由发布流水线承担

平台清单是「该平台最新发布」的自描述配置，新清单一经发布即取代旧清单成为判定来源。因此：

- 新增 `force_update`、`min_supported_version` 两个 workflow_dispatch 输入；`force_update=是` 时门槛取本次平台版本，显式输入优先，都未提供时由流水线读取上一版同平台清单的 `minSupportedVersion` 沿用（读取方式与现有 appcast 维护步骤一致，走 GitHub API 取最新同平台 Release 的清单资产）。
- 校验：格式 `X.Y.Z`（允许 v 前缀）、不高于本次平台版本；不满足即失败终止。前者防止门槛永远不可达导致升级后仍被拦截，后者防止笔误。
- 两端平台各自计算，互不影响（沿用 per-platform-release 的平台独立原则）。

「取消强制」属于低频应急操作：手动重传最新清单将字段置空，或后续发布显式给出更低门槛。

### 启动后台检查，不阻塞启动，失败放行

在 `main.dart` 现有 macOS Sparkle 静默检查的位置附近，对阵两端统一发起一次基于 `UpdateService.checkLatest()` 的静默检查（macOS 原先不走该服务，为门禁判定改为复用；其设置页仍只由 Sparkle 驱动）：

- 检查在 `runApp` 之后异步发起，不参与 Splash 路由决策、不阻塞首帧；离线冷启动不会等待网络超时。
- 不依赖登录会话，未登录与冷启动恢复会话的用户同样受门禁约束。
- 失败（离线、超时、响应异常）静默放行，且不缓存任何判定结论，下次启动重查——与既有「更新检查失败不影响使用」的取舍一致。
- 该检查不受 macOS「启动时自动检查更新」用户开关约束（否则用户可关闭开关绕过门禁）；受 `DISABLE_STARTUP_UPDATE_CHECK` 编译开关约束（见下）。

替代方案——在 Splash 中 await 检查结果再分流：离线时最坏阻塞 10 秒，破坏冷启动体验，弃用。

### 门禁用应用外壳级替换，而非路由拦截

`MaterialApp.builder` 包裹应用内容：门禁生效时整个 `child` 被强制升级页替换。应用外壳已在 `AnimatedBuilder` 中监听 `AppController`，门禁状态放在该控制器上即可驱动替换，成本低；且 `MaterialApp.builder` 的 `child` 是整棵导航树，替换即覆盖所有路由与弹窗。

相比仿 `changePassword` 的 forced 路由方案：

- 路由方案可借助既有全局 navigatorKey（分享导入、传输对话框已在使用）发出跳转，但「替换哪一个路由」在弹窗叠加（分享导入目录框、传输任务对话框）与任意深度栈下容易出错或被绕过，Splash 中已有为此踩坑的路由等待逻辑。
- 外壳替换与路由栈无关：无论当前在登录页、主页还是任意弹窗之上，界面都被整体替换；返回键、关闭弹窗等不构成绕过路径；门禁解除（重试后不再强制）时被替换的界面自然回归。

强制页（新页面）内容：当前版本、最低支持版本与升级引导；主操作「立即升级」、次操作「重试」与「退出应用」，Android 返回键不可退出拦截（PopScope 拦截）。

### 升级动作复用现有链路

- Android：复用 `UpdateService.downloadAndroid()`（下载 → SHA-256 与清单摘要一致 → 系统安装器），在页内展示进度与失败信息；不可安装时提示手动下载（复用 Releases 页跳转）。
- macOS：点击「立即升级」调用 `MacosSparkleUpdater.instance.checkManually()` 触发 Sparkle 原生确认/下载/安装；失败态展示提示与「手动下载」兜底。用户若在 Sparkle 弹窗中选择跳过，仅返回拦截页，拦截不解除。
- 判定结果复用同一次 `checkLatest()` 返回的 `AvailableUpdate`（资产地址、清单说明），门禁页与设置页共享同一服务。

### 调试开关与本地开发配置

- `DISABLE_STARTUP_UPDATE_CHECK` 语义扩展为「关闭启动检查（含门禁检查）」；保持既有行为：macOS 上同时禁用 Sparkle 原生自动调度并在设置页锁定开关展示。
- 本地调试配置 `secrets/client/local.json`（git-crypt 加密）补充该开关为 true：本地构建版本固定为 `0.0.1+1`，不注入开关时任何真实门槛都会拦截本地开发。
- 不采用「仅 release 构建参与门禁」的方案：会把门禁行为对开发构建完全隐藏，不利于本地验证拦截与升级交互；显式调试开关是本项目已有模式（Sparkle 启动检查即如此）。

### 判定与比较细节

- 判定：`compareAppVersions(当前版本, minSupportedVersion) < 0` 即强制；比较忽略 `+build`，统一使用运行时版本读取的产物版本。
- 字段缺省、空串或无法解析 → 不判定强制（兼容旧清单与滚动发布期间的新旧清单并存）。
- `latestForPlatform` 未找到平台发布或清单资产（含清单被删除）→ 无判定，放行。

## Risks / Trade-offs

- [启动检查引入 GitHub 可达性依赖（国内网络）] → 检查静默、失败无感、不阻塞启动；清单本身仍走 GitHub 是既有事实（OSS 镜像变更只覆盖大文件下载），可接受。
- [门槛配置错误导致大面积拦截] → 流水线校验门槛不高于本次版本，保证升级后必然放行；拦截页始终可用（升级/重试/退出）；应急可通过重传清单置空字段恢复。
- [可选发布意外抹掉已有门槛] → 流水线默认沿用上一版同平台门槛；仅显式输入可下调。
- [用户长期离线或使用旧版本不升级] → 放行是已确认的取舍；致命问题场景依赖用户联网后于下次启动被拦截。
- [macOS 用户跳过 Sparkle 弹窗后再无提示] → 拦截页常驻直至升级完成，跳过弹窗不解除门禁。

## Migration Plan

1. 先合并发布流水线改动（输入、字段生成、沿用与校验）：字段为空时对所有客户端无行为影响，可先行发布验证清单结构。
2. 合并客户端改动；为本地调试配置注入 `DISABLE_STARTUP_UPDATE_CHECK=true`。
3. 真机验证三条路径：构造/发布一份门槛高于当前版本的清单验证拦截与升级闭环；构造门槛不高于当前版本的清单验证放行；断网启动验证失败放行。macOS 额外验证关闭「启动时自动检查更新」后门禁仍生效。
4. 常规发布保持现有操作；需要强制升级时勾选 `force_update`，需要显式门槛时填 `min_supported_version`。
5. 回滚：客户端可回退到上一发布版本；策略回滚（清除门槛）通过重传最新清单置空字段完成。
