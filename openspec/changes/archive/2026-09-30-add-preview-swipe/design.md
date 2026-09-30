# 设计：图片预览滑动切换与沉浸式界面

## 关键决策

### 切换手势与方向映射

`GestureDetector` 同时监听横向与纵向拖拽结束，以 `primaryVelocity` 判定方向与力度（阈值 120 px/s 防误触）。左滑/上滑（velocity < 0）切下一张，右滑/下滑切上一张，取模实现首尾循环。不采用 `PageView`：PageView 只能单轴跟随手指，无法满足"上下左右"四向切换要求。

### 推移动画

`_ImagePreviewBody` 持有 `AnimationController`（280ms）驱动双层 `Stack`：

- 新图 `Tween(begin: 滑动方向偏移, end: zero)` + `Curves.easeOutCubic`
- 旧图 `Tween(begin: zero, end: 反方向偏移)` + `Curves.easeInCubic`

进入偏移由预览页 `_onSwipe` 根据滑动轴向与正负计算后经 `transitionOffset` 下发。动画中途再次切换时先把进行中的入帧落定为当前帧，再开新动画，避免错乱。

### 缩略图先行与原图升级

切换时并发发起 `loadThumbnail`（本地磁盘缓存近乎即时命中）与 `loadImagePreview`：

- 缩略图先到 → 立即推入显示，`_hiResLoading = true`；
- 原图后到 → 原地替换字节（`gaplessPlayback: true` 防闪烁），徽标消失；
- 原图先到 → 直接推入原图，徽标从未显示；
- 原图失败/空响应 → `_hiResLoading = false`，已有画面则保留，无画面则进入错误重试态；
- 缩略图失败 → 静默降级等待原图。

loading 徽标显示条件为"原图加载中 && 新图内容已开始展示"（`_incomingPath` 或 `_displayedPath` 等于当前 item 路径），保证徽标不出现在尚未切走的旧图上。

并发请求用自增 `_loadSeq` 守卫：旧序号的回调全部忽略，状态只归属最新目标图。

### 沉浸式界面

`previewType == image` 时 Scaffold/AppBar 背景纯黑、前景白色；图片区域无卡片、无边距、全屏铺满；`x / N` 为底部悬浮半透明胶囊。非图片预览保持原有浅色卡片布局。

### 回收站加载路径

回收站文件本体已迁移至 `.trash/<批次>/payload/`，`entry.objects` 映射"原路径 → 批次内路径"。预览加载用批次内路径构造 `FileItem`，另通过 `PreviewPageArguments.displayPaths`（实际路径 → 展示路径）让顶栏仍显示原位置，避免暴露内部路径。

## 取舍

- 甩动触发动画而非实时跟手：四向跟手需自实现双轴手势竞技场，复杂度高收益低；甩动 + 推移动画已满足体验目标
- 不做双指缩放、预加载邻图等扩展，保持一期最小实现
