# 提案：Android 系统后退键改为返回上级目录

## Why

Android 端目录浏览采用状态切换（`setCurrentPath`）而非路由压栈，导致系统后退键（含手势）在任何层级都会直接退出应用。用户在子目录中误触后退即被弹出应用，不符合 Android 平台的导航直觉，也无法逐级返回浏览路径。此外，`WorkspacePage` 内的 `PopScope` 在 `IndexedStack` 中即使切到其他 tab 也仍注册在路由上：当「文件」处于根目录时，在回收站等其他 tab 按后退会直接退出应用，与用户预期不符。

## What Changes

- 在工作区目录浏览页（`WorkspacePage`）拦截 Android 系统后退：非根目录时后退返回上一级目录，不退出应用
- 到达根目录（全部文件）后恢复系统默认行为，后退键退出应用
- 非「文件」tab（传输、回收站、我的）触发系统后退时，先切换回「文件」tab，不退出应用；仅在「文件」tab 且位于根目录时，后退才退出应用
- 已在 client 子仓库实现并通过真机（Android 16）验证
- macOS 桌面端无系统后退路由，不受影响

## Capabilities

### New Capabilities

- `workspace-back-navigation`: 工作区目录浏览页对系统后退键的拦截与逐级返回行为，覆盖子目录返回、其他 tab 先切回「文件」、根目录退出三个核心场景

### Modified Capabilities

（无 —— 现有规格中没有涉及系统后退导航的要求）

## Impact

- 客户端：`client/lib/features/workspace/presentation/home_shell.dart`（移动端 `Scaffold` 包裹 `PopScope`，统一处理所有 tab 的后退拦截，依赖 `AppController.currentPath` / `rootPrefix` / `parentPath`）
- 客户端：`client/lib/features/workspace/presentation/workspace_page.dart`（移除页内 `PopScope`，避免与 HomeShell 层重复拦截；`_goUp` 等目录切换能力保持不变）
- 不涉及服务端、接口契约或其他客户端页面（预览页等路由页的后退由自身路由栈处理，行为不变）
