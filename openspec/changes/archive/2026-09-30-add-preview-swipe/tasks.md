# 任务

## 1. 滑动切换

- [x] 1.1 `PreviewPageArguments` 新增 `imageFiles`，工作区 `_openPreview` 传入同目录图片列表
- [x] 1.2 `PreviewPage` 改为 StatefulWidget，维护当前下标与首尾循环；`x / N` 序号与文件名、路径、下载目标联动
- [x] 1.3 `_ImagePreviewBody` 监听四向拖拽结束，左滑/上滑下一张、右滑/下滑上一张，速度阈值防误触

## 2. 切换动效与加载策略

- [x] 2.1 `AnimationController` 驱动双层 Stack 推移动画（新图滑入、旧图反向滑出），方向由滑动轴向决定
- [x] 2.2 动画中途再次切换先落定当前帧；`_loadSeq` 守卫并发回调
- [x] 2.3 缩略图先行：并发加载缩略图与原图，缩略图就绪立即展示，原图就绪后 `gaplessPlayback` 无缝升级
- [x] 2.4 右下角 loading 徽标仅在"原图加载中且新图已开始展示"时出现；原图失败/空响应不残留徽标
- [x] 2.5 缩略图不可用时静默降级为保持旧图直至原图就绪

## 3. 沉浸式界面

- [x] 3.1 图片预览 Scaffold/AppBar 纯黑背景、白色前景，图片全屏铺满去除卡片与圆角
- [x] 3.2 `x / N` 序号改为底部悬浮半透明胶囊；非图片预览保持原样式

## 4. 回收站预览入口

- [x] 4.1 回收站列表/网格/桌面壳接入 `onPreview`，点击图片文件打开预览
- [x] 4.2 `PreviewPageArguments.displayPaths` 支持按批次对象路径加载、界面显示原位置路径

## 5. 验证与归档

- [x] 5.1 Android 真机（RMX6699）走查：工作区与回收站图片预览、四向切换、动效、缩略图先行与徽标时序
- [x] 5.2 边界检查：快速连滑、原图先到、原图失败/空响应、回看缓存图等场景无旧图残留徽标
- [x] 5.3 `flutter analyze` 无告警；delta 规格同步至 `openspec/specs/image-preview/spec.md`
