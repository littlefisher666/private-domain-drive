## Why

缩略图浏览模式目前只展示图片占位样式，用户无法在目录中快速辨认图片内容；同时原图可能较大，不适合直接作为网格预览。基于阿里云 OSS 图片处理能力按需生成小尺寸缩略图，可以提升图片浏览效率，并保持文件流量直连 OSS 的一期架构。

## What Changes

- 为图片文件增加基于 OSS 图片处理参数的缩略图读取能力。
- 在客户端缩略图模式中展示真实图片缩略图，非图片文件继续展示默认类型图标。
- 在图片详情页展示经 OSS 图片处理后的真实预览，并将预览页下载接入传输队列。
- 增加缩略图请求的内存缓存，减少目录滚动和重建造成的重复请求。
- 缩略图加载失败、图片处理失败或凭证失效时，稳定回退到图片类型默认图标。
- 保持现有 STS 临时凭证和 OSS 云端鉴权边界，不新增文件内容中转接口。

## Capabilities

### New Capabilities

- `oss-image-thumbnails`: 定义图片缩略图生成、加载、缓存和失败降级行为。

### Modified Capabilities

<!-- No existing capability requirements are changed. -->

## Impact

- 客户端 `OssClient`、工作区网格缩略图组件及相关状态/缓存逻辑。
- 客户端图片预览请求会使用 OSS `x-oss-process` 图片处理参数，仍通过现有 STS 权限访问对象。
- 服务端 STS Policy 无需新增接口；需确认 `oss:GetObject` 权限覆盖图片处理读取。
- 不新增第三方 Flutter 依赖，优先复用现有 `http`、Flutter 图片组件和认证签名实现。
