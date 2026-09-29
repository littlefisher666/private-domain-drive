## 1. 客户端实现

- [x] 1.1 在 `client/lib/features/workspace/presentation/workspace_page.dart` 的 build 方法用 `PopScope` 包裹 `Scaffold`，`canPop` 由 `controller.currentPath == AppController.rootPrefix` 派生
- [x] 1.2 `onPopInvokedWithResult` 中对未放行的后退调用既有 `_goUp()` 返回上级目录

## 2. 验证

- [x] 2.1 `dart format` 与 `dart analyze` 通过（无新增告警）
- [x] 2.2 真机（Android 16，RMX6699）验证：子目录按后退逐级返回上级，应用不退出
- [x] 2.3 真机验证：根目录按后退恢复系统默认行为，正常退出应用
- [x] 2.4 回归确认：预览页路由后退行为不变（由路由栈自行处理）
