# Proposal: add-recycle-bin-item-actions

## Why

移动端（Android）回收站中，条目右侧"更多"按钮点击后直接触发恢复，长按无任何响应，且移动端布局没有详情面板，用户在手机上完全找不到"立即删除"入口，只能等 30 天生命周期自动清理或先恢复再删。桌面端能力与移动端入口不一致，需要在移动端补齐操作入口。

## What Changes

- 回收站页移动端：点击条目右侧"更多"按钮不再直接触发恢复，改为弹出底部操作菜单，展示条目名称、类型与剩余保留天数，并提供「恢复」与「立即删除」（红色危险样式）两个操作，各自沿用原有二次确认流程。
- 回收站页移动端：长按条目同样弹出上述操作菜单。
- `WorkspaceListView`、`WorkspaceGridView`、`_MobileUniformGrid` 增加可选 `onLongPress` 回调：传入时长按触发该回调，不传入保持原有"长按进入多选"行为，共享空间等多选场景不受影响。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `recycle-bin`: 新增移动端条目操作入口要求——移动端 SHALL 通过条目操作菜单（"更多"按钮或长按）提供恢复与立即删除两个操作，且立即删除 MUST 保留二次确认。

## Impact

- 客户端 `client/lib/features/workspace/presentation/recycle_bin_page.dart`：新增 `_showItemActions` 底部菜单并重接 `onMore`/`onLongPress`。
- 客户端 `client/lib/features/workspace/presentation/workspace_page.dart`：`WorkspaceListView`/`WorkspaceGridView`/`_MobileUniformGrid` 增加可选 `onLongPress` 参数并透传。
- 已在 Android 真机（RMX6699）验证通过；不影响 macOS 桌面端详情面板交互。
