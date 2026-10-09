# document-preview 增量规格

## ADDED Requirements

### Requirement: PDF 直接预览
用户在详情页打开 `.pdf` 文件时，客户端 SHALL 下载文件并直接渲染展示 PDF 内容：支持连续滚动翻页与双指缩放，页面底部 SHALL 显示当前页码/总页数指示。加载期间 SHALL 显示加载指示。PDF 预览 SHALL NOT 显示占位文案。

#### Scenario: 打开 PDF 直接渲染
- **WHEN** 用户在详情页打开一个 `.pdf` 文件
- **THEN** 客户端 SHALL 下载该文件并渲染第一页内容，底部显示页码指示（如 "1 / N"），不显示占位文案

#### Scenario: 滚动翻页与页码更新
- **WHEN** 用户在 PDF 预览中滚动到下一页
- **THEN** 客户端 SHALL 渲染并展示该页内容，且页码指示 SHALL 同步更新

#### Scenario: 双指缩放
- **WHEN** 用户在 PDF 预览中双指缩放
- **THEN** 页面内容 SHALL 按手势缩放展示，SHALL NOT 导致页面布局错乱

### Requirement: 大 PDF 懒渲染
PDF 预览 SHALL 按可视区域懒渲染：仅渲染当前可视页及相邻页，SHALL NOT 将整本 PDF 或全部页位图载入内存。文件下载 SHALL 采用流式落盘方式，SHALL NOT 整段读入内存。

#### Scenario: 打开大 PDF 首屏快速呈现
- **WHEN** 用户打开一个页数较多或体积较大的 PDF
- **THEN** 客户端 SHALL 流式下载落盘后仅渲染首屏页面，首屏呈现 SHALL NOT 等待全部页面渲染完成

#### Scenario: 翻页时按需渲染
- **WHEN** 用户滚动到尚未渲染过的页面
- **THEN** 客户端 SHALL 按需渲染该页，SHALL NOT 预先渲染全部页面

### Requirement: PDF 本地缓存
PDF 下载完成后 SHALL 落盘缓存（键含文件版本标识）。用户再次打开同一版本的 PDF 时 SHALL 直接命中本地缓存，SHALL NOT 重复下载。

#### Scenario: 重复打开命中缓存
- **WHEN** 用户关闭后再次打开同一版本（未编辑更新）的 PDF
- **THEN** 客户端 SHALL 从本地缓存直接加载展示，不发起网络下载

#### Scenario: 文件更新后重新下载
- **WHEN** PDF 在服务端被替换（版本标识变化）后用户重新打开
- **THEN** 客户端 SHALL 重新下载新版本内容

### Requirement: 文本直接预览
用户在详情页打开文本类文件（`.txt`/`.md`/`.json` 等）时，客户端 SHALL 下载内容、解码后直接展示：使用等宽字体、可滚动、内容可选择复制。文本预览 SHALL NOT 显示占位文案。

#### Scenario: 打开文本直接展示
- **WHEN** 用户在详情页打开一个 `.md` 文件
- **THEN** 客户端 SHALL 下载并解码后以等宽字体滚动展示内容，不显示占位文案

#### Scenario: 文本内容可复制
- **WHEN** 用户在文本预览中长按选择文字
- **THEN** 客户端 SHALL 支持选中并复制所选择的内容

### Requirement: 文本编码处理
文本预览 SHALL 按以下顺序确定编码：BOM 检测 → UTF-8 严格解码 → GBK 解码。全部失败时 SHALL 按 UTF-8 replacement 字符展示并提示编码未知，SHALL NOT 崩溃或中断预览。

#### Scenario: UTF-8 文本正常展示
- **WHEN** 用户打开 UTF-8 编码（无 BOM）的文本文件
- **THEN** 客户端 SHALL 正确解码并完整展示内容

#### Scenario: GBK 文本回退解码
- **WHEN** 用户打开 GBK 编码的文本文件
- **THEN** 客户端 SHALL 回退用 GBK 解码并正确展示中文内容

#### Scenario: 无法识别编码时不崩溃
- **WHEN** 文本内容无法用 UTF-8 或 GBK 解码
- **THEN** 客户端 SHALL 以 replacement 字符展示并提示编码未知，不崩溃、不退出预览

### Requirement: 大文本分段加载
超过分段大小（1MB）的文本文件 SHALL 分段按需加载：首屏仅获取第一段，滚动接近底部时 SHALL 自动加载下一段并拼接展示；累计加载达到上限（20MB）时 SHALL 停止加载并提示下载查看完整文件。分段获取 SHALL 使用范围请求，SHALL NOT 一次性下载整个大文件。

#### Scenario: 大文本首屏仅加载第一段
- **WHEN** 用户打开一个 5MB 的文本文件
- **THEN** 客户端 SHALL 仅获取第一段（1MB）内容展示，SHALL NOT 下载整个文件

#### Scenario: 滚动到底自动续载
- **WHEN** 用户滚动接近已加载内容底部
- **THEN** 客户端 SHALL 自动加载下一段并无缝拼接展示

#### Scenario: 达到上限提示下载
- **WHEN** 累计加载内容达到 20MB 上限
- **THEN** 客户端 SHALL 停止继续加载并提示用户下载查看完整文件

### Requirement: 预览加载失败处理
PDF 或文本下载/加载失败时，客户端 SHALL 展示错误状态与重试入口，重试 SHALL 重新发起加载；SHALL NOT 停留在空白页面或无反馈状态。

#### Scenario: 下载失败可重试
- **WHEN** 网络异常导致 PDF 下载失败
- **THEN** 客户端 SHALL 展示错误提示与重试按钮

#### Scenario: 重试成功恢复展示
- **WHEN** 用户在失败状态点击重试且本次下载成功
- **THEN** 客户端 SHALL 恢复并展示文件内容

### Requirement: 文本类型扩展名扩充
代码、配置与日志类扩展名（`.dart`/`.py`/`.js`/`.ts`/`.yaml`/`.yml`/`.xml`/`.log`/`.ini`/`.sh` 等）SHALL 按 text 类型进入文本预览，复用文本解码与展示链路。

#### Scenario: 打开代码文件直接预览
- **WHEN** 用户在详情页打开一个 `.py` 文件
- **THEN** 客户端 SHALL 按文本预览直接展示其内容，不提示仅支持下载

### Requirement: Markdown 渲染视图
`.md` 文件 SHALL 默认以 Markdown 渲染视图展示（标题、列表、代码块、链接等），并 SHALL 提供「渲染/源码」切换；源码视图 SHALL 复用纯文本预览的展示能力。

#### Scenario: Markdown 默认渲染展示
- **WHEN** 用户在详情页打开一个 `.md` 文件
- **THEN** 客户端 SHALL 以渲染后的富文本视图展示内容（标题/列表/代码块等正确渲染）

#### Scenario: 切换查看源码
- **WHEN** 用户在 Markdown 预览中切换到「源码」视图
- **THEN** 客户端 SHALL 以纯文本方式展示 Markdown 原文，并可再切回渲染视图

### Requirement: CSV 表格化展示
`.csv` 文件 SHALL 以表格形式展示：按逗号分列（含引号包裹的基本处理）、首行为表头、表格横向与纵向可滚动。文件超大时 SHALL 复用大文本分段与累计上限策略；解析结果列数严重不规则时 SHALL 回退纯文本展示。

#### Scenario: CSV 表格展示
- **WHEN** 用户在详情页打开一个 `.csv` 文件
- **THEN** 客户端 SHALL 以表格展示内容，首行为表头，表格可横向与纵向滚动

#### Scenario: CSV 解析异常回退纯文本
- **WHEN** CSV 内容列数严重不规则导致表格化不可读
- **THEN** 客户端 SHALL 回退为纯文本方式展示内容
