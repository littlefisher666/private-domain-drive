# 设计：Android 系统后退键改为返回上级目录

## Context

工作区目录浏览（`WorkspacePage`）基于 `AppController.currentPath` 状态切换目录，而非 `Navigator` 压栈。因此 Android 系统后退（按键 / 手势）触发的是路由弹栈，在根路由上直接结束 Activity 退出应用。

目录切换入口已统一收敛在 `AppController.setCurrentPath`（内部 `_normalizeDir` + `notifyListeners`），页面通过 `AppScope`（`InheritedNotifier<AppController>`）订阅状态变化重建。既有的「返回上级」能力 `_goUp()`（含根目录判断与 `parentPath` 计算）已在桌面端和移动端标题栏按钮中使用。

## Goals / Non-Goals

**Goals:**

- Android 系统后退在非根目录时执行 `_goUp()` 返回上级，根目录时恢复默认退出行为
- 拦截状态随目录切换实时更新，与页面标题/返回按钮状态一致
- 不影响预览页等 `Navigator` 路由页的后退行为，不影响 macOS 桌面端

**Non-Goals:**

- 不做 Android Predictive Back 手势动画
- 不引入基于路由栈的目录导航重构（一期保持状态切换方案）
- 不处理多选模式下后退先退多选的叠加逻辑（保持最小实现，后续可按需增强）

## Decisions

### Decision 1：用 `PopScope` 包裹 `WorkspacePage` 的 `Scaffold`，而非监听 `SystemChannels` 原始后退事件

- `PopScope`（Flutter 3.22+，`onPopInvokedWithResult`）是框架推荐的后退拦截 API，`WillPopScope` 已废弃
- 通过 `canPop: controller.currentPath == AppController.rootPrefix` 声明式控制：非根目录 `canPop=false` 拦截弹栈并回调 `_goUp()`；根目录 `canPop=true` 直接放行，退出行为完全交给系统
- 备选的 `EventChannel` 监听 `KEYCODE_BACK` 方案绕过框架路由协议，会破坏 Predictive Back 兼容性，不采用

### Decision 2：复用 `AppController` 状态而非新增页面内部导航栈

- 拦截状态直接由 `currentPath` 派生，`AppScope` 的 `InheritedNotifier` 保证 `canPop` 在每次目录切换后随重建刷新，与标题栏「返回上级」按钮的可用状态天然一致
- 备选的页面内部维护历史栈方案需要处理侧边栏跳转、分享导入落盘路径等所有入口的入栈时机，复杂度高且易与桌面端不一致，不采用

### Decision 3：拦截放在 `HomeShell` 移动端 `Scaffold` 层而非 `WorkspacePage` 内部

- `WorkspacePage` 处于 `IndexedStack` 中，其内部的 `PopScope` 即使在非「文件」tab 时也仍注册在当前 `ModalRoute` 上：当「文件」位于根目录（`canPop=true`）时，在回收站等其他 tab 按后退会直接放行退出应用；当「文件」处于子目录时，后退会在后台静默切换目录，行为不可预期
- 将唯一一处 `PopScope` 上移到 `HomeShell` 移动端分支：`canPop = _index == 0 && currentPath == rootPrefix`，`onPopInvokedWithResult` 中按「非「文件」tab 先切回「文件」→「文件」tab 内非根目录 `setCurrentPath(parentPath)` → 根目录放行」的顺序处理，一次性覆盖所有 tab
- 目录切换复用 `AppController.setCurrentPath`，`WorkspacePage` 经 `AppScope`（`InheritedNotifier`）重建时在 build 中调用 `_syncDirectoryBinding` 自动重新加载列表，与页内 `_goUp()` 行为一致
- 传输、回收站、我的等 tab 无目录层级概念，后退统一先回「文件」符合 Android「后退逐级回退到首页再退出」的惯例

## Risks / Trade-offs

- [多选模式/排序面板等局部状态下按后退会直接切目录而非先清除局部状态] → 一期接受；局部状态均为可恢复视图状态，目录切换时 `setCurrentPath` 已清理选中状态
- [`canPop` 依赖 `notifyListeners` 驱动的重建，若未来目录切换不触发通知会出现状态滞后] → `setCurrentPath` 统一入口已保证通知；新增入口必须走该入口（现有代码已如此）
- [根目录后退退出应用与用户预期仍可能存在差异（如期望最小化到后台）] → 与 Android 平台惯例一致，一期不定制

## Migration Plan

纯客户端 UI 行为变更，无数据迁移。随 client 子仓库正常发版。回滚仅需移除 `PopScope` 包裹层。

## Open Questions

（无 —— 非根目录返回与根目录退出已真机验证通过；非「文件」tab 后退切回「文件」待真机回归）
