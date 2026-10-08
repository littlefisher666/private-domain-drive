# photo-viewer 规格 delta

## REMOVED Requirements

### Requirement: 视频条目不支持在线播放

**Reason**: 视频条目已支持通过 OSS 预签名 URL 流式在线播放，"仅截帧展示 + 下载原图"的旧口径不再成立，由 `video-streaming-playback` 能力规格取代。

**Migration**: 视频条目在查看器中改为内嵌播放器（封面为截帧缩略图、点击播放、不自动播放），下载原图操作保留。原图缓存记录、云朵角标行为不变；视频条目 SHALL NOT 出现在照片的上一张/下一张连续浏览序列中的既有约束继续有效。

## MODIFIED Requirements

### Requirement: 查看器提供基础操作与连续浏览

大图查看器 SHALL 提供：上一张/下一张切换（可在当前分组内连续浏览）、下载原图（未缓存时展示原图大小）、删除（走回收站流程）、macOS 复制（见 photo-gallery）、Android 分享（见 photo-gallery）。查看器 SHALL 支持滚轮缩放与方向键切换。视频条目的查看 SHALL 走内嵌播放器（行为见 video-streaming-playback），其下载原图操作与照片一致。

#### Scenario: 连续切换浏览

- **WHEN** 用户在查看器中连续点击下一张至分组末尾
- **THEN** 浏览在当前分组范围内循环或停止，不越界报错

#### Scenario: 查看器内下载原图

- **WHEN** 用户对未缓存照片点击下载原图
- **THEN** 开始后台下载，完成后原位替换展示并清除云朵角标

#### Scenario: 查看器内删除

- **WHEN** 用户在查看器中删除当前照片
- **THEN** 该照片进入回收站，从索引与时间线移除，查看器切换到相邻照片

#### Scenario: 键盘与滚轮操作

- **WHEN** macOS 用户使用方向键或滚轮
- **THEN** 方向键切换上一张/下一张，滚轮缩放当前图片
