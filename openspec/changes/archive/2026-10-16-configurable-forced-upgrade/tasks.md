# Tasks

## 1. 发布流水线（client 仓库）

- [x] 1.1 `client/.github/workflows/release.yml` 的 workflow_dispatch 新增 `force_update`（布尔，默认否）与 `min_supported_version`（字符串，可空）输入；验证：YAML 解析通过（actionlint 或本地语法检查），输入定义与 design.md 一致，真实发布中的输入呈现由 3.2 确认
- [x] 1.2 prepare 阶段新增各平台最低支持版本解析与校验：`force_update` 取本次平台版本、显式输入优先、均未提供时经 GitHub API 读取上一版同平台清单沿用（无历史则为空）；冲突、格式非法（非 `X.Y.Z`）、超过本次版本三种情况报错终止；验证：以样例参数本地运行等价 bash 片段，断言七种输入组合（强制/显式/沿用/无历史/冲突/非法/超上界）的输出或报错符合预期，沿用查询的真实行为由 3.2 检验 CI 输出
- [x] 1.3 Android 与 macOS 两处清单生成（jq）写入 `minSupportedVersion` 字段；验证：本地以样例参数运行同款 jq 表达式，核对字段存在、v 前缀去除与空值表达；真实清单由 3.2 检查

## 2. 客户端（client 仓库）

- [x] 2.1 更新清单模型与强制判定：`GithubRelease` 解析 `minSupportedVersion`（去 v 前缀、空值容忍），`UpdateCheckResult` 暴露最低支持版本与可用更新，提供「当前版本低于最低支持版本」判定（复用 `compareAppVersions`，忽略 `+build`）；验证：扩展 `client/test/update_service_test.dart` 覆盖字段解析、缺省字段、判定边界（低于/等于/高于、v 前缀），`flutter test test/update_service_test.dart` 全绿
- [x] 2.2 门禁状态与启动静默检查：`AppController` 增加门禁状态与启动检查方法，`main.dart` 在 `runApp` 后对两端发起检查（受 `DISABLE_STARTUP_UPDATE_CHECK` 约束，不受 macOS `autoCheckUpdates` 约束），检查失败静默放行且不缓存结论；验证：单元测试覆盖状态流转（强制生效/不强制/失败放行/开关跳过），本地启动观察调试日志确认检查发起与失败无感
- [x] 2.3 强制升级页与应用外壳替换：`MaterialApp.builder` 在门禁生效时以页面替换整棵导航树，页面展示当前与最低支持版本，提供「立即升级」「重试」「退出应用」，Android 返回键不可绕过（PopScope）；验证：widget 测试门禁激活即替换、重试解除后恢复原界面；Android 真机确认返回键与退出按钮行为
- [x] 2.4 两端「立即升级」动作接入：Android 页内进度复用 `UpdateService.downloadAndroid`（含 SHA-256 校验与系统安装）并提供失败重试与手动下载；macOS 触发 `MacosSparkleUpdater.checkManually()` 并提供失败兜底；验证：模拟器/真机手工触发按钮与失败提示（错误地址场景），完整闭环由 3.2/3.3 覆盖
- [x] 2.5 调试开关与本地配置：扩展 `app_constants.dart` 中 `DISABLE_STARTUP_UPDATE_CHECK` 的语义注释（跳过启动检查含门禁），并在主仓库 `secrets/client/local.json`（git-crypt）注入 `"DISABLE_STARTUP_UPDATE_CHECK": true`；验证：注入后本地启动不发起检查不拦截；临时移除注入并以构造门槛验证拦截生效
- [x] 2.6 client 仓库 `flutter analyze` 与全量 `flutter test` 通过

## 3. 集成验证与文档

- [x] 3.1 更新主仓库 `docs/技术文档.md`「更新分发机制」章节（清单字段、流水线输入、门禁行为、调试开关）与 `AGENTS.md` 本地调试说明；验证：文档中的输入名、字段名、行为描述与实现逐项核对一致
- [x] 3.2 Android 端到端：构造门槛高于既有安装版本的清单（启用 `force_update` 发布或重传最新清单），以旧版安装包验证拦截 → 应用内下载升级 → 重启放行；断网启动验证放行、恢复网络重启后被拦截。（2026-10-16 完成：run 38857048221 以 `force_update=是` 发布 android/v1.0.14，清单 `minSupportedVersion` 为 1.0.14；真机 1.0.13 启动即进入拦截 → 拦截页「立即升级」应用内下载（命中缓存包）并安装 → 1.0.14 重启门禁检查通过放行；飞行模式启动时 OSS 与 GitHub 链路均不可达，门禁检查失败静默放行，恢复网络重启后重新进入拦截）
- [x] 3.3 macOS 端到端：同链路走 Sparkle 安装；关闭「启动时自动检查更新」后门禁仍生效；跳过 Sparkle 弹窗后仍停留在拦截页。（2026-10-16 完成：同次发布 macos/v1.0.18，清单 `minSupportedVersion` 为 1.0.18；真机 1.0.17 启动即进入拦截 → 「立即升级」触发 Sparkle 原生下载与安装 → 1.0.18 重启放行；关闭「启动时自动检查更新」后启动仍被拦截；在 Sparkle 弹窗中选择跳过仅返回拦截页，拦截不解除）
- [x] 3.4 回归：未启用强制的常规可选发布在两端与现状一致；读取无 `minSupportedVersion` 的旧清单不被拦截；设置页更新检查功能不受启动静默检查影响。（2026-10-16 完成：非强制发布 run 38847624180（1.0.13/1.0.17，门槛为空）两端安装使用与现状一致、无拦截；缺字段/空值清单不判定强制由 `update_service_test.dart` 用例覆盖，且门槛为空的清单上线期间客户端运行未被拦截；真机日志中启动门禁检查与设置页/UI 更新检查各自独立完成，未互相影响）

## Workflow follow-up

- 归档 change 并同步 `openspec/specs` 主规格（按项目 openspec 流程）。
- 主仓库更新 client submodule 指针，记录子仓库提交引用变化。
