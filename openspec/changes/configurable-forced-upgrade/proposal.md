# Proposal

## Why

当前客户端只有可选升级：用户可以跳过更新提示继续使用旧版本。当出现关键缺陷、协议或数据不兼容等必须整体升级才能正确工作的场景时，缺少一种在发布时声明「本次升级强制」并让旧版本无法继续使用的机制。需要把「本次发布强制还是可选」变成发布时可配置的一项策略。

## What Changes

- 平台更新清单 `private-domain-drive-update.json` 增加 `minSupportedVersion`（最低支持版本）字段：发布时可将最低支持版本设为本次版本（等价于「本次升级强制」）；不指定时沿用上一版同平台清单的值；缺省或为空表示不限制。
- 发布流水线新增发布输入：`force_update`（本次强制）与 `min_supported_version`（显式门槛）；两端按各自平台版本独立处理，并校验门槛格式合法且不高于本次发布版本。
- 客户端（Android 与 macOS）启动后新增一次静默清单检查，比对当前运行版本与最低支持版本；低于最低支持版本时，整个应用界面被不可跳过的强制升级页替代（无「稍后」、不可返回），仅提供「立即升级」「重试」与「退出应用」。
- 升级动作复用现有链路：Android 应用内下载（SHA-256 校验）并发起系统安装；macOS 触发 Sparkle 交互式检查与安装，失败时提供手动下载兜底。Sparkle 原生弹窗可被用户跳过，因此强制门禁由应用层页面承担。
- 检查失败（离线、GitHub 不可达、超时）时放行，不缓存拦截结论，下次启动重新检查；macOS「启动时自动检查更新」用户开关不豁免强制门禁检查；`DISABLE_STARTUP_UPDATE_CHECK` 编译开关同时关闭门禁的启动检查，本地调试配置补充该开关以避免本地开发版本被真实策略拦截。
- 可选升级行为保持不变：Android 设置页检查弹窗、macOS Sparkle 弹窗与设置页交互均不调整；服务端（FC）与业务接口无任何改动。

## Capabilities

### New Capabilities

- `forced-upgrade-gate`: 客户端最低支持版本判定与强制升级门禁：启动静默检查、低于最低支持版本时不可跳过的全屏升级拦截页、平台升级动作衔接、检查失败放行策略与调试开关关系。

### Modified Capabilities

- `per-platform-release`: 更新清单结构增加最低支持版本字段；发布流水线新增强制/可选输入与生成规则（含沿用上一版值、格式与上界校验）。
- `release-update-management`: 补充两端启动静默清单检查与失败静默语义；调整 macOS 条款——macOS 可读取静态清单用于强制升级门禁判定，但更新检查与交付仍由 Sparkle 承担。

## Impact

- `client/.github/workflows/release.yml`：新增 `force_update` / `min_supported_version` 输入；最低支持版本沿用查询与校验；Android 与 macOS 两处清单生成加入字段。
- 客户端 `client/lib/`：清单模型解析 `minSupportedVersion`、最低版本判定与门禁状态；启动检查接入（`main.dart` / `AppBootstrap`）；应用外壳在门禁生效时替换整体界面；新增强制升级页；扩展 `DISABLE_STARTUP_UPDATE_CHECK` 语义。
- 主仓库 `secrets/client/local.json`（git-crypt）：本地调试配置补充 `DISABLE_STARTUP_UPDATE_CHECK`。
- 主仓库 `docs/技术文档.md`：更新分发机制章节同步强制升级链路说明；`docs/接口.md` 无变化（无服务端改动）。
- 发布操作：日常可选发布保持现有流程；需要强制升级时使用新输入。旧客户端与旧清单双向兼容——旧客户端忽略新字段，新客户端将缺省字段视为不限制。
