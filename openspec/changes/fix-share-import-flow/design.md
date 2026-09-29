# 设计：分享导入上传闭环修复与弹窗内新建文件夹

## Context

分享导入链路：原生 `MainActivity` 通过 MethodChannel（`private_domain_drive/share_import`）投递分享内容 → `app.dart` 订阅并在登录就绪后直接 `showDialog(ShareTargetDialog)` → 用户选定目录后立即创建上传任务。弹窗为无条件渲染「上传到此处」的 `AlertDialog`，目录浏览使用弹窗内部 `_directories` 局部状态；防重入由 `_openedShareSignature` + `_shareDialogShowing` 双字段控制。新建文件夹能力已存在于 `AppController.createFolder(name, {targetPath})`，主界面工作区已复用 `AppFeedback.promptText` 输入交互。

两处缺陷的根因：

1. **取消后无法重新分享**：`_openedShareSignature` 在弹窗打开前置位，取消弹窗时未清除；同一批内容第二次分享时签名相等直接 return，弹窗永远不再出现。
2. **弹窗被启动跳转顶掉**：Flutter `pushReplacementNamed` 替换的是 Navigator 栈顶路由而非调用者自身。冷启动分享时弹窗在启动页 350ms 停留窗口内被压到栈顶，随后启动页 `pushReplacementNamed(home)` 实际替换掉的是弹窗，栈变为 [Splash, Home]，弹窗销毁。登录页登录成功跳转存在同类隐患。

## Goals / Non-Goals

**Goals:**

- 分享导入全流程闭环：弹窗内建目录 → 直接上传，无需中途取消弹窗
- 取消导入后重新分享同一批内容可再次进入目录选择
- 消除启动页/登录页跳转误删上层弹窗的路由竞态

**Non-Goals:**

- 不改造分享导入的整体链路（MethodChannel、直弹目录选择模式均保持不变）
- 不涉及 macOS 端（无系统分享接收）
- 不引入独立的新建文件夹页面或路由

## Decisions

1. **弹窗内新建文件夹复用既有能力而非新链路**：`ShareTargetDialog` 标题栏新增 `create_new_folder` 图标按钮，点击后走 `AppFeedback.promptText` 输入名称，调用 `controller.createFolder(name.trim(), targetPath: _currentPath)`，成功后 `_loadDirectories()` 刷新弹窗内局部状态。备选方案是让用户取消弹窗去主界面建目录再重新分享——这正是被修复的断裂路径，且新链路（对话框局部嵌套）成本低、与工作区交互一致。
2. **取消弹窗时清除 `_openedShareSignature` 而非改为时间窗失效**：签名本意是防止 AnimatedBuilder 重建期间对同一批 items 重复弹窗，取消意味着本次导入意图终结，清除签名语义准确；`prepareShareImport(items: const [])` 已保证清空待上传项，不存在重建期误弹风险。
3. **启动页/登录页跳转前轮询等待自身回到栈顶**：跳转前检查 `ModalRoute.of(context)?.isCurrent`，若被更高层路由覆盖则以 100ms 间隔等待，弹窗关闭（用户确认或取消）后恢复跳转。备选方案是改用 `push + removeRoute` 自绘替换或引入 NavigatorObserver 跟踪路由栈——前者移除时机难精确（`pushNamed` 的 Future 在路由 pop 时才完成），后者改动面大；轮询方案只在启动页/登录页两个调用点生效，局部且可读。
4. **弹窗内建目录不做「自动进入新目录」**：创建后仅刷新列表，用户自行点选进入或直接「上传到此处」（新目录就在当前目录内）。避免自动跳转改变用户预期的上传目标层级。

## Risks / Trade-offs

- [轮询等待期间用户长时间停留在弹窗，启动页滞留后台] → 轮询仅在两处一次性跳转前执行，弹窗关闭即恢复，无资源占用；若会话在等待期失效，由既有的 `_navigateToLoginOnSessionLoss` 兜底。
- [弹窗内创建目录依赖 OSS 写权限，失败时中断] → 复用主界面同款错误提示（`Bad state:` 前缀剥离 + Snack），失败不关闭弹窗，可重试或直接取消导入。
- [登录页同样存在弹窗压顶时跳转的隐患，当前时序下未必触发] → 与启动页统一加等待逻辑，消除时序依赖，覆盖「未登录分享 → 登录后弹窗压顶」的组合场景。

## Open Questions

（无 —— 实现已完成，真机闭环验证待最新构建确认）
