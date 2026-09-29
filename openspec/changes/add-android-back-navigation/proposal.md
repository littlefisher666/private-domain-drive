# 提案：Android 系统后退键改为返回上级目录

## Why

Android 端目录浏览采用状态切换（`setCurrentPath`）而非路由压栈，导致系统后退键（含手势）在任何层级都会直接退出应用。用户在子目录中误触后退即被弹出应用，不符合 Android 平台的导航直觉，也无法逐级返回浏览路径。

## What Changes

- 在工作区目录浏览页（`WorkspacePage`）拦截 Android 系统后退：非根目录时后退返回上一级目录，不退出应用
- 到达根目录（全部文件）后恢复系统默认行为，后退键退出应用
- 已在 client 子仓库实现（`PopScope` + 既有 `_goUp()`），并通过真机（Android 16）验证：子目录逐级返回、根目录退出应用
- macOS 桌面端无系统后退路由，不受影响

## Capabilities

### New Capabilities

- `workspace-back-navigation`: 工作区目录浏览页对系统后退键的拦截与逐级返回行为，覆盖子目录返回、根目录退出两个核心场景

### Modified Capabilities

（无 —— 现有规格中没有涉及系统后退导航的要求）

## Impact

- 客户端：`client/lib/features/workspace/presentation/workspace_page.dart`（build 方法包裹 `PopScope`，依赖 `AppController.currentPath` / `rootPrefix` / 既有 `_goUp()`）
- 不涉及服务端、接口契约或其他客户端页面（预览页等路由页的后退由自身路由栈处理，行为不变）
