# Tasks: add-recycle-bin-item-actions

## 1. 组件层长按回调

- [x] 1.1 `WorkspaceListView` 增加可选 `onLongPress` 参数与字段，移动端 ListTile 长按优先走 `onLongPress`（不传回落 `onToggle`）
- [x] 1.2 `WorkspaceGridView` 增加可选 `onLongPress` 参数与字段，并透传给移动端 `_MobileUniformGrid`
- [x] 1.3 `_MobileUniformGrid` 增加可选 `onLongPress` 参数，`_buildOtherRow` 与 `_buildTile` 长按优先走 `onLongPress`

## 2. 回收站操作菜单

- [x] 2.1 `recycle_bin_page.dart` 新增 `_showItemActions` 底部菜单（条目名称、类型、剩余天数 + 恢复 + 红色立即删除），复用 `_restoreItem`/`_purgeItem`
- [x] 2.2 列表与网格的 `onMore` 与 `onLongPress` 均接到 `_showItemActions`

## 3. 验证与提交

- [x] 3.1 `flutter analyze` 无新增告警
- [x] 3.2 Android 真机验证：三个点与长按均弹出菜单，恢复/立即删除流程正常，共享空间长按多选不受影响
