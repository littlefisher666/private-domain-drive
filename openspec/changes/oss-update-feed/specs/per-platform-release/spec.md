# Spec Delta

## ADDED Requirements

### Requirement: OSS 更新清单固定路径
发布流水线 SHALL 在生成各平台更新清单后，将其上传到 OSS 发布目录固定路径 `releases/<platform>/update.json`（公开读、覆盖式最新指针）；上传或匿名探测不通过时 SHALL 移除该平台 OSS 上的旧清单对象以触发客户端回退 GitHub，并照常完成发布，SHALL NOT 因该环节失败标记流水线失败。

#### Scenario: 上传最新指针成功
- **WHEN** 流水线生成某平台清单且 OSS 上传与匿名探测通过
- **THEN** `releases/<platform>/update.json` SHALL 为该平台本次发布清单（含该平台版本号与资产字段），匿名直链无需任何凭证即可下载

#### Scenario: 上传或探测失败清理旧指针
- **WHEN** 清单上传失败或上传后匿名探测未通过
- **THEN** 流水线 SHALL 移除该平台 OSS 上既有的 `update.json` 对象（避免客户端读取过期清单假报已是最新），记录回退日志并照常完成发布

#### Scenario: 镜像凭证缺失跳过上传
- **WHEN** 发布流水线未配置 OSS 发布镜像凭证
- **THEN** 流水线 SHALL 跳过清单上传且 SHALL NOT 报错中断，客户端侧按 OSS 清单不可用回退 GitHub

### Requirement: OSS appcast 固定路径
发布流水线 SHALL 在维护 macOS appcast 时将合并后的 `appcast.xml` 上传到 OSS 固定路径 `releases/macos/appcast.xml`（公开读）；上传或匿名探测不通过时 SHALL 移除 OSS 上的旧 appcast 以触发客户端回退 GitHub feed，并照常完成发布；GitHub `appcast` 分支的推送 SHALL 保持不变。

#### Scenario: 发版同步上传两份
- **WHEN** macOS 发布合并出新 appcast 内容
- **THEN** OSS `releases/macos/appcast.xml` SHALL 与该内容一致且匿名可下载，同时 GitHub `appcast` 分支 SHALL 收到相同内容

#### Scenario: 上传或探测失败清理旧对象
- **WHEN** appcast 上传失败或上传后匿名探测未通过
- **THEN** 流水线 SHALL 移除 OSS 上既有的 `appcast.xml` 对象（客户端探测失败回退 GitHub feed），记录回退日志并照常完成发布
