## Why

当前详情页（PreviewPage）仅支持图片的真正渲染展示，PDF 与文本（txt/md/json 等）类型虽已被识别分类，但详情页只显示占位文案，用户必须下载后借助外部应用才能查看内容。文件内容类（PDF/文本）是网盘高频查看类型，缺直接预览影响基础使用体验。

## What Changes

- 详情页对 `.pdf` 文件提供直接渲染预览：分页展示、支持翻页（滑动/按钮）、页码指示，不再显示占位文案
- 详情页对文本类文件（`.txt`/`.md`/`.json` 等）提供直接内容预览：按编码解码（UTF-8 优先、可探测 GBK）后以等宽可滚动方式展示
- 大文件流式/懒加载：大 PDF 按页懒渲染（不整本载入内存），大文本设置加载上限（超限仅展示前 N KB 并提示），避免内存暴涨
- 详情页对音频文件（`.mp3`/`.m4a`/`.flac`/`.wav`/`.aac` 等）提供直接播放：复用 media_kit 引擎，预签名 URL 流式播放，提供播放/暂停、进度条等播放器控件
- 文本类型扩展名扩充：代码/配置/日志类扩展名（`.dart`/`.py`/`.js`/`.yaml`/`.xml`/`.log` 等）纳入文本预览，复用现有文本渲染链路
- `.md` 文件提供 Markdown 渲染视图（标题/列表/代码块等富文本渲染），并保留源码/渲染切换
- `.csv` 文件提供表格化展示（分列渲染、可滚动），比纯文本可读性更好
- 预览内容获取复用现有 OSS 直连与磁盘缓存基础设施，不新增服务端接口
- 视频预览不在本次范围内（保持现状：视频仍在相册查看器播放）

## Capabilities

### New Capabilities

- `document-preview`: 详情页 PDF 与文本文档的直接预览能力，包括 PDF 分页渲染与翻页、文本解码展示（含代码/配置/日志类扩展名）、Markdown 渲染与源码切换、CSV 表格化展示、大文件流式/懒加载与加载失败处理
- `audio-preview`: 详情页音频文件的直接播放能力，包括流式播放、播放器控件与退出停止播放

### Modified Capabilities

（无——`image-preview` 中"文本、PDF 等非图片类型保持原有页面样式"的要求不受影响，本次不改变图片预览行为）

## Impact

- **客户端（client/ 子仓库）**：
  - `lib/features/preview/presentation/preview_page.dart`：pdf/text 分支从占位文案改为真实渲染组件，新增音频分支
  - `lib/features/preview/` 下新增 PDF 渲染、文本展示、Markdown 渲染、CSV 表格、音频播放组件及状态管理
  - `lib/features/preview/domain/preview_type.dart`：扩充 text 类型扩展名清单
  - `lib/shared/cache/disk_image_cache.dart` 或同类磁盘缓存：可能需扩展支持文档缓存键（复用 LRU 机制）
  - `oss_client.dart`：可能需新增文档字节/预签名 URL 获取方法
- **依赖**：新增 PDF 渲染第三方包（`pdfrx`，pdfium 双端同核心统一渲染）、`flutter_markdown`（Markdown 渲染）、`enough_convert`（GBK 解码）；音频复用已有 `media_kit`
- **服务端**：无改动（文件流量始终客户端直连 OSS）
- **文档**：归档后无需更新 docs/接口文档（无接口变化）
