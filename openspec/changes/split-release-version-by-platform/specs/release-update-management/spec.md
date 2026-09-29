## MODIFIED Requirements

### Requirement: 检查静态更新清单
客户端 SHALL 通过 GitHub Releases 列表接口查询发布记录，选取 tag 匹配当前平台前缀（`android/` 或 `macos/`）的最新一个 Release，读取该 Release 附带的 `private-domain-drive-update.json`，并只在清单产品版本高于当前版本且存在当前平台资产时提示更新。

#### Scenario: 发现当前平台的新版本
- **WHEN** 当前平台最新 Release 的清单版本高于当前版本且包含当前平台资产
- **THEN** 客户端 SHALL 展示远端版本与更新操作；清单未提供更新说明时 SHALL 展示“暂无更新说明”

#### Scenario: 当前已是最新版本
- **WHEN** 当前平台最新 Release 的清单版本不高于当前版本
- **THEN** 客户端 SHALL 提示已是最新版本

#### Scenario: 另一端单独发版
- **WHEN** 当前平台最新 Release 的版本不高于当前版本，而其他平台存在更新的 Release
- **THEN** 客户端 SHALL 不提示更新

#### Scenario: 当前平台缺少资产
- **WHEN** 当前平台最新 Release 的清单未包含当前平台要求的 `.apk` 或 `.dmg` 发布资产
- **THEN** 客户端 SHALL 不将该清单版本视为可更新版本

#### Scenario: 不存在平台匹配的 Release
- **WHEN** Releases 列表中没有任何 tag 匹配当前平台前缀的发布记录
- **THEN** 客户端 SHALL 提示已是最新版本，且不得报错中断
