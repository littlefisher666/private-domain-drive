## 1. 客户端实现

- [x] 1.1 在 `client/lib/features/workspace/presentation/workspace_page.dart` 的 build 方法用 `PopScope` 包裹 `Scaffold`，`canPop` 由 `controller.currentPath == AppController.rootPrefix` 派生
- [x] 1.2 `onPopInvokedWithResult` 中对未放行的后退调用既有 `_goUp()` 返回上级目录
- [x] 1.3 将后退拦截从 `WorkspacePage` 内的 `PopScope` 上移到 `HomeShell` 移动端 `Scaffold`：`canPop` 为「文件 tab 且根目录」，未放行时非「文件」tab 先切回「文件」，「文件」tab 内非根目录调用 `setCurrentPath(parentPath)` 返回上级
- [x] 1.4 移除 `WorkspacePage` 内部 `PopScope`，避免 `IndexedStack` 离屏子页仍注册路由导致其他 tab 后退行为错乱

## 2. 验证

- [x] 2.1 `dart format` 与 `dart analyze` 通过（无新增告警）
- [x] 2.2 真机（Android 16，RMX6699）验证：子目录按后退逐级返回上级，应用不退出
- [x] 2.3 真机验证：根目录按后退恢复系统默认行为，正常退出应用
- [x] 2.4 回归确认：预览页路由后退行为不变（由路由栈自行处理）
- [ ] 2.5 真机验证：回收站、传输、我的 tab 按后退切换回「文件」tab，不退出应用
- [ ] 2.6 真机验证：切回「文件」后再按后退，非根目录返回上级、根目录退出应用
