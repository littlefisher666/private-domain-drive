# preview-pdf-text 技术设计

## Context

客户端详情页 `lib/features/preview/presentation/preview_page.dart` 目前仅对 image 类型有真实渲染（`_ImagePreviewBody`），pdf/text 类型在 `PreviewTypeResolver`（`lib/features/preview/domain/preview_type.dart:9-32`）中已完成分类，但页面分支只渲染占位文案。

现有可复用基础设施：

- **图片链路**：`app_controller.dart` 的 `loadImagePreview` → `oss_client.dart` 的 `getObjectBytes`（`packages/private_domain_oss` FFI 整段字节加载）+ `DiskImageCache`（磁盘 LRU，预览缓存 1GB）
- **视频链路**：`presignVideoUrl` 生成预签名 URL → media_kit 流式播放
- **依赖**：http、path_provider 已在 pubspec.yaml 中

用户已确认范围：PDF、文本、音频预览与 Markdown/CSV 增强渲染，不涉及视频；大文件支持流式/懒加载。

## Goals / Non-Goals

**Goals:**

- 详情页对 `.pdf` 直接分页渲染预览，支持滚动翻页、双指缩放、页码指示
- 详情页对文本类文件解码后直接展示，等宽字体、可滚动、可复制；文本类型扩展名扩充至代码/配置/日志类
- `.md` 提供 Markdown 渲染视图并保留源码切换；`.csv` 提供表格化展示
- 详情页对音频文件提供直接播放（播放/暂停、进度条），预签名 URL 流式
- 大 PDF 按页懒渲染，不整本载入内存；大文本分段（Range GET）按需加载
- 复用 OSS 直连与磁盘 LRU 缓存模式，不新增服务端接口

**Non-Goals:**

- 视频预览收进详情页（视频仍在相册查看器播放）
- PDF 目录/书签/全文搜索、文本高亮编辑等高级文档能力
- Office 文档、HTML、epub 等其他格式
- 文本内容落盘缓存（小文件重取成本低，避免版本一致性问题）

## Decisions

### D1: PDF 渲染库选用 pdfrx（基于 pdfium）

- pdfrx 基于 Google PDFium，Android/macOS 双端用同一渲染核心，视觉一致；支持从本地文件打开、按可视区懒渲染页面、原生缩放与拖拽手势。
- 备选方案：
  - `syncfusion_flutter_pdfviewer`：功能全但体积大、商用许可复杂，超出最小可用原则
  - 原生双通道（macOS PDFKit + Android PdfRenderer）：双端两套实现、渲染行为不一致、维护成本高
  - `pdx`：同为 pdfium 封装，选 pdfrx 因其 API 活跃度与文档更好

### D2: 文档获取统一走「预签名 URL + http 流式下载」

- 新增 `presignObjectUrl`（复用现有 presign 机制）+ http 流式下载到本地缓存文件。PDF 下载落盘后由 pdfrx 打开，pdfium 可对文件随机按页访问，天然满足"不整本入内存"。
- 备选方案：`getObjectBytes` 整段字节（大文件内存峰值高，违背流式目标）。

### D3: 文本编码策略——UTF-8 优先，GBK 回退

- 依次：BOM 检测 → UTF-8 严格解码 → GBK 解码（`enough_convert` 纯 Dart 实现，避免新增平台通道）→ 仍失败按 UTF-8 replacement 字符展示并提示编码未知。
- 仅对 text 类型尝试解码；非文本二进制被误分类时兜底展示乱码提示而非崩溃。

### D4: 缓存——新建文档 LRU 缓存，复用 DiskImageCache 机制

- PDF 下载完成后落盘缓存：独立目录与限额（512MB），键 = objectPath + versionToken，与现有 `DiskImageCache` 相同的 LRU 驱逐机制。
- 文本不落盘，按需重新拉取。

### D5: 大 PDF 懒渲染

- pdfrx 的 `PdfViewer` 内建"仅渲染可视页及相邻页"行为，位图按设备 DPR 限制分辨率；翻回已浏览页时重渲染（不缓存全部页位图）。

### D6: 大文本分段加载

- 分段大小 1MB：首屏通过 OSS Range GET 只取第一段，滚动接近底部时预取下一段并拼接；累计加载上限 20MB，达到后显示"内容过大，请下载查看完整文件"提示并停止加载。
- 小于分段大小的文件整段取回，走 `getObjectBytes`，与图片链路一致。

### D7: 音频预览复用 media_kit

- 音频与视频同用 media_kit 引擎：`presignObjectUrl` 生成预签名 URL 交给 `Player` 流式播放，不整段下载、不引入第二套音频引擎（如 just_audio）。
- UI 为自建控件条（播放/暂停、进度条、时长），退出详情页时 dispose 播放器即停止播放。

### D8: Markdown 渲染视图

- `.md` 默认用 `flutter_markdown` 渲染为富文本（标题/列表/代码块/链接），顶栏提供「渲染/源码」切换；源码视图复用纯文本组件，编码链路与文本一致。
- 备选方案：默认纯文本 —— 放弃，Markdown 是高频格式，渲染视图收益明显。

### D9: CSV 表格化展示

- 手写轻量解析（处理引号包裹与转义的基本情况），首行为表头；渲染为横向+纵向可滚动表格，行渲染用懒加载 ListView。
- 大文件复用 D6 的分段与 20MB 上限策略；解析异常（列数严重不规则）时回退纯文本展示。
- 备选方案：引入 csv 解析包 —— 放弃，需求仅基本分列，不值得新增依赖。

### D10: 文本类型扩展名扩充

- `PreviewTypeResolver` 与 `FileKind` 的 text 扩展名清单加入代码/配置/日志类（`.dart`/`.py`/`.js`/`.ts`/`.yaml`/`.yml`/`.xml`/`.log`/`.ini`/`.sh` 等），`.csv` 单独归入表格预览类型，其余渲染链路完全复用。

## Risks / Trade-offs

- [pdfium 原生库体积] 每平台约增加 3~5MB 安装包体积 → 一期权衡可接受，收益是双端一致渲染
- [依赖数量增加] 本次新增 pdfrx/flutter_markdown/enough_convert 三个包 → 均为活跃维护的主流包，接口面小，必要时可替换
- [Range 请求与预签名兼容] Range 头不参与 OSS 签名计算，需实测确认分段下载在双端可用 → 实现阶段优先验证；不可用时降级为整段下载 + 仅首段解码展示
- [GBK 误判] 二进制内容被当文本打开可能乱码 → 解码失败兜底 replacement + 提示，不崩溃
- [超大 PDF 页面位图内存] 高分辨率页全屏渲染内存峰值 → 按 DPR 限制渲染分辨率、仅缓存可视页
- [pdfrx 维护风险] 第三方包停更 → pdfium 核心稳定，且接口面小，必要时可换 pdx

## Migration Plan

纯客户端增量改动，无数据迁移。回滚方式：还原客户端子仓库提交即可，缓存目录可残留无害（LRU 自淘汰）。

## Open Questions

（无——分段大小、缓存限额等参数已定为初值，实现后可按实际体验调整）
