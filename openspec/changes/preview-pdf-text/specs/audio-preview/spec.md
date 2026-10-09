# audio-preview 增量规格

## ADDED Requirements

### Requirement: 音频直接播放预览
用户在详情页打开音频文件（`.mp3`/`.m4a`/`.flac`/`.wav`/`.aac` 等）时，客户端 SHALL 提供直接播放预览：包含播放/暂停、可拖动进度条与时长展示。播放 SHALL 通过预签名 URL 流式进行，SHALL NOT 等待整个文件下载完成。

#### Scenario: 打开音频直接播放
- **WHEN** 用户在详情页打开一个 `.mp3` 文件并点击播放
- **THEN** 客户端 SHALL 流式加载并开始播放，展示播放控件（播放/暂停、进度条、时长），不显示占位文案

#### Scenario: 暂停与恢复
- **WHEN** 用户在播放中点击暂停后再次点击播放
- **THEN** 客户端 SHALL 从暂停位置继续播放

#### Scenario: 拖动进度条跳转
- **WHEN** 用户拖动进度条到某一位置
- **THEN** 客户端 SHALL 跳转到该位置继续播放

### Requirement: 退出预览停止播放
用户关闭音频预览页时，客户端 SHALL 停止播放并释放播放器资源。

#### Scenario: 关闭页面停止播放
- **WHEN** 用户在音频播放中返回或关闭详情页
- **THEN** 客户端 SHALL 立即停止播放，SHALL NOT 在页面关闭后继续出声

### Requirement: 音频加载失败处理
音频加载或播放失败时，客户端 SHALL 展示错误状态与重试入口，SHALL NOT 停留在空白页面或无反馈状态。

#### Scenario: 音频加载失败可重试
- **WHEN** 网络异常或文件损坏导致音频加载失败
- **THEN** 客户端 SHALL 展示错误提示与重试按钮，重试成功后 SHALL 恢复播放
