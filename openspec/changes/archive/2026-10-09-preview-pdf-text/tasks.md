# preview-pdf-text 实施任务

实施均在 client/ 子仓库内进行，完成后回主仓库更新 submodule 指针。

## 1. 依赖与基础设施

- [x] 1.1 在 client/pubspec.yaml 添加 `pdfrx`、`flutter_markdown`、`enough_convert` 依赖并验证双端编译通过
- [x] 1.2 oss_client 新增通用 `presignObjectUrl`（复用视频预签名机制），并新增基于 http 的流式下载到本地文件方法（支持进度回调与取消）
- [x] 1.3 验证 OSS 预签名 URL + Range 请求分段下载在双端可用（不可用则按设计降级整段下载）
- [x] 1.4 参照 DiskImageCache 机制新建文档 LRU 磁盘缓存（独立目录、512MB 限额、键=objectPath+versionToken，提供写入/命中/驱逐）

## 2. PDF 预览

- [x] 2.1 实现 PDF 加载流程：缓存命中 → 直接打开；未命中 → 流式下载落盘 → 写入缓存 → pdfrx 打开
- [x] 2.2 实现 `_PdfPreviewBody`：pdfrx PdfViewer 连续滚动 + 双指缩放 + 底部悬浮页码指示（"x / N"）+ 加载指示
- [x] 2.3 preview_page.dart 将 pdf 分支从占位文案替换为 `_PdfPreviewBody`，失败时展示错误重试状态

## 3. 文本预览

- [x] 3.1 `PreviewTypeResolver` 与 `FileKind` 扩充 text 扩展名清单（`.dart`/`.py`/`.js`/`.ts`/`.yaml`/`.yml`/`.xml`/`.log`/`.ini`/`.sh` 等），`.md`/`.csv` 归入专用类型
- [x] 3.2 实现文本获取：小文件（≤1MB）走 getObjectBytes；大文件走 Range 分段获取（首段 1MB）
- [x] 3.3 实现编码解码链：BOM 检测 → UTF-8 严格 → GBK（enough_convert）→ replacement 兜底提示
- [x] 3.4 实现 `_TextPreviewBody`：等宽字体、可滚动、SelectionArea 可复制、加载指示
- [x] 3.5 实现大文本滚动接近底部自动续载下一段并拼接；累计 20MB 上限后停止并提示下载查看完整文件
- [x] 3.6 preview_page.dart 将 text 分支替换为 `_TextPreviewBody`，失败时展示错误重试状态

## 4. Markdown 与 CSV 渲染

- [x] 4.1 实现 `_MarkdownPreviewBody`：flutter_markdown 渲染视图 + 顶栏「渲染/源码」切换（源码复用 `_TextPreviewBody`）
- [x] 4.2 实现 `_CsvPreviewBody`：轻量解析（含引号包裹）+ 首行表头 + 横纵可滚动表格（懒加载行），复用分段与 20MB 上限；列数严重不规则时回退纯文本
- [x] 4.3 preview_page.dart 接入 md/csv 分支，失败时复用错误重试状态

## 5. 音频预览

- [x] 5.1 实现 `_AudioPreviewBody`：media_kit Player + 预签名 URL 流式播放，播放/暂停、可拖动进度条、时长展示
- [x] 5.2 退出详情页时 dispose 播放器停止播放；加载/播放失败展示错误重试
- [x] 5.3 `PreviewTypeResolver`/`FileKind` 新增 audio 类型（`.mp3`/`.m4a`/`.flac`/`.wav`/`.aac` 等）并接入 preview_page.dart

## 6. 验证

- [x] 6.1 macOS 端实测：打开 PDF（含多页大文件）滚动/缩放/页码正常；打开 UTF-8、GBK 文本正常展示与复制；Markdown 渲染与切换、CSV 表格、音频播放正常
- [x] 6.2 Android 端实测同上场景
- [x] 6.3 验证缓存命中（重复打开不重复下载）、版本更新后重新下载、各类型失败重试
- [x] 6.4 验证大文本/大 CSV 分段加载与 20MB 上限提示、音频退出即停；确认图片预览、视频播放等既有功能无回归

## 7. 收尾

- [x] 7.1 在 client/ 子仓库提交实现
- [x] 7.2 主仓库更新 submodule 指针并提交
- [x] 7.3 归档 change（`/opsx:archive`）并同步 document-preview、audio-preview 主规格
