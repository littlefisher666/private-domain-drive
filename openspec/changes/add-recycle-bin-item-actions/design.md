# Design: add-recycle-bin-item-actions

## Context

回收站页复用共享空间的浏览组件外壳（`WorkspaceListView` / `WorkspaceGridView`）。移动端布局没有详情面板，「立即删除」按钮只存在于桌面端 `detailBuilder` 中；移动端条目唯一的操作回调 `onMore` 被直接接到了 `_restoreItem`。组件层的长按行为被硬编码为 `onToggle(item)`（多选切换），回收站传入空函数导致长按无响应。

## Goals / Non-Goals

**Goals:**
- 移动端回收站通过"更多"按钮和长按两种方式触达「恢复」与「立即删除」。
- 操作入口与桌面端复用同一套确认逻辑（`_restoreItem` / `_purgeItem`），不复制业务代码。

**Non-Goals:**
- 不支持只删除批次中的单个文件或文件夹（立即删除仍按批次整体操作）。
- 不改动共享空间的多选交互与桌面端详情面板。

## Decisions

- **组件层新增可选 `onLongPress` 参数，而非复用 `onToggle` 语义**：`WorkspaceListView` / `WorkspaceGridView` / `_MobileUniformGrid` 增加 `ValueChanged<FileItem>? onLongPress`，长按回调写成 `(onLongPress ?? onToggle)(item)`。不传该参数的调用方（共享空间页等）行为完全不变；避免用"把多选切换回调偷换成弹菜单"这种语义污染。替代方案是让回收站把 `_showItemActions` 传给 `onToggle`——被否决，因为 `onToggle` 同时服务多选复选框，语义不符。
- **底部菜单复用共享空间 `_showItemActions` 的视觉模式**：`showModalBottomSheet` + 顶部条目信息 + `ListTile` 操作项；「立即删除」用 `colorScheme.error` 红色标识危险操作。菜单关闭（`Navigator.pop`）后再执行动作，保证确认弹窗浮在页面上下文而非 sheet 之上。
- **菜单项直接复用现有 `_restoreItem` / `_purgeItem`**：二者已含二次确认、错误提示与刷新逻辑，菜单只做入口分发。

## Risks / Trade-offs

- [长按参数在桌面端网格同样生效] → 回收站桌面端仍以详情面板为主入口，长按弹菜单不冲突；共享空间不传该参数，行为不变。
- [立即删除按批次整体执行，虚拟目录中的子项也会整批删除] → 与桌面端行为一致；菜单副标题展示剩余天数帮助用户识别批次，后续如需单文件粒度删除另立提案。
