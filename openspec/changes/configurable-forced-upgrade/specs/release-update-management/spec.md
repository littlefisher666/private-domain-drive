# Spec Delta

## MODIFIED Requirements

### Requirement: 检查静态更新清单

Android 客户端 SHALL 通过 GitHub Releases 列表接口查询发布记录，在 tag 匹配 `android/` 前缀的发布中选取版本号最高的一个（不依赖接口返回顺序），读取该 Release 附带的 `private-domain-drive-update.json`，并只在清单产品版本高于当前版本且存在 Android 资产时提示更新；macOS 客户端的更新检查与交付由 Sparkle 能力承担，SHALL NOT 通过静态更新清单提示或交付更新，但两端 SHALL 读取本平台清单用于最低支持版本门禁判定（见 forced-upgrade-gate 能力）。

#### Scenario: 发现当前平台的新版本

- **WHEN** Android 客户端检查更新，且 Android 版本号最高的 Release 清单版本高于当前版本并包含 Android 资产
- **THEN** 客户端 SHALL 展示远端版本与更新操作；清单未提供更新说明时 SHALL 展示“暂无更新说明”

#### Scenario: 当前已是最新版本

- **WHEN** 当前平台版本号最高的 Release 清单版本不高于当前版本
- **THEN** 客户端 SHALL 提示已是最新版本

#### Scenario: 另一端单独发版

- **WHEN** 当前平台版本号最高的 Release 版本不高于当前版本，而其他平台存在版本号更高的 Release
- **THEN** 客户端 SHALL 不提示更新

#### Scenario: 当前平台缺少资产

- **WHEN** 当前平台版本号最高的 Release 清单未包含当前平台要求的 `.apk` 或 `.dmg` 发布资产
- **THEN** 客户端 SHALL 不将该清单版本视为可更新版本

#### Scenario: 不存在平台匹配的 Release

- **WHEN** Releases 列表中没有任何 tag 匹配当前平台前缀的发布记录
- **THEN** 客户端 SHALL 按已是最新版本静默处理并提示暂未发现本平台的发布版本，且不得报错中断

#### Scenario: macOS 读取清单仅用于门禁

- **WHEN** macOS 客户端执行启动静默检查
- **THEN** 客户端 SHALL 读取本平台清单的 `minSupportedVersion` 用于门禁判定，SHALL NOT 据此触发 Sparkle 链路之外的更新提示或更新交付

## ADDED Requirements

### Requirement: 更新清单字段的向后兼容

更新清单的字段变更 SHALL 保持向后兼容：新增字段 SHALL NOT 改变既有字段的含义与结构；新版客户端读取不包含新增字段的旧清单时 SHALL 按缺省语义处理且不得报错。

#### Scenario: 旧客户端读取新清单

- **WHEN** 未包含强制升级能力的旧版客户端读取带有 `minSupportedVersion` 字段的新清单
- **THEN** 其更新检查行为 SHALL 与字段不存在时一致，SHALL NOT 报错或改变既有提示逻辑

#### Scenario: 新客户端读取旧清单

- **WHEN** 客户端读取不包含 `minSupportedVersion` 字段的清单
- **THEN** 客户端 SHALL 按不限制处理，SHALL NOT 判定强制升级
