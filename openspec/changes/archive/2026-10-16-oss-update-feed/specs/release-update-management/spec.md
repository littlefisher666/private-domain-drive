# Spec Delta

## MODIFIED Requirements

### Requirement: 检查静态更新清单
Android 客户端 SHALL 优先从 OSS 发布目录固定路径 `releases/android/update.json` 获取静态更新清单；OSS 清单请求失败（网络错误、超时、状态码非 200、内容无法解析）时 SHALL 回退为通过 GitHub Releases 列表接口查询发布记录，在 tag 匹配 `android/` 前缀的发布中选取版本号最高的一个（不依赖接口返回顺序），读取该 Release 附带的 `private-domain-drive-update.json`，并只在清单产品版本高于当前版本且存在 Android 资产时提示更新；macOS 客户端 SHALL NOT 再通过静态更新清单检查更新，其更新检查改由 Sparkle 能力承担。

#### Scenario: OSS 清单优先命中
- **WHEN** Android 客户端检查更新且 OSS 固定路径清单成功返回
- **THEN** 客户端 SHALL 直接以该清单作为本次检查依据，SHALL NOT 查询 GitHub Releases 列表

#### Scenario: OSS 清单不可用时回退
- **WHEN** OSS 清单请求网络错误、超时、状态码非 200 或内容无法解析
- **THEN** 客户端 SHALL 转入 GitHub Releases 列表回退链路完成本次检查；仅当回退链路同样失败时 SHALL 按检查失败处理

#### Scenario: 发现当前平台的新版本
- **WHEN** Android 客户端检查更新，且获取到的清单产品版本高于当前版本并包含 Android 资产
- **THEN** 客户端 SHALL 展示远端版本与更新操作；清单未提供更新说明时 SHALL 展示“暂无更新说明”

#### Scenario: 当前已是最新版本
- **WHEN** 客户端获取到的当前平台清单版本不高于当前版本
- **THEN** 客户端 SHALL 提示已是最新版本

#### Scenario: 另一端单独发版
- **WHEN** 当前平台清单版本不高于当前版本，而其他平台存在版本号更高的发布
- **THEN** 客户端 SHALL 不提示更新

#### Scenario: 当前平台缺少资产
- **WHEN** 当前平台版本号最高的 Release 清单未包含当前平台要求的 `.apk` 或 `.dmg` 发布资产
- **THEN** 客户端 SHALL 不将该清单版本视为可更新版本

#### Scenario: 不存在平台匹配的 Release
- **WHEN** Releases 列表中没有任何 tag 匹配当前平台前缀的发布记录
- **THEN** 客户端 SHALL 按已是最新版本静默处理并提示暂未发现本平台的发布版本，且不得报错中断

### Requirement: 更新检查请求超时
Android 客户端 SHALL 为 OSS 清单请求设置 5 秒超时，并为 GitHub 请求（发布列表与更新清单）各设置 10 秒超时；OSS 清单超时 SHALL 转入 GitHub 回退链路，GitHub 请求超时 SHALL 按检查失败处理；macOS 端 appcast 拉取超时由 Sparkle 原生链路处理，SHALL NOT 使用该 Dart 侧超时配置。

#### Scenario: OSS 清单超时回退
- **WHEN** OSS 清单请求超过 5 秒未返回
- **THEN** 客户端 SHALL 终止该请求并转入 GitHub 回退链路，SHALL NOT 仅因 OSS 超时直接展示检查失败

#### Scenario: 请求超时按失败处理
- **WHEN** Android 端回退链路的发布列表或更新清单请求超过 10 秒未返回
- **THEN** 客户端 SHALL 终止等待并按检查失败路径展示失败提示与手动下载入口，SHALL NOT 长时间挂起加载状态
