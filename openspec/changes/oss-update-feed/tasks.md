# Tasks

## 1. 发布流水线：OSS 更新清单与 appcast 上传

- [x] 1.1 在「生成平台更新清单」之后新增「上传 OSS 更新清单」步骤：将各平台清单上传到 `releases/<platform>/update.json`（public-read、`application/json`）并匿名探测；上传或探测不通过时删除该平台旧指针并记录回退日志，不中断发布；凭证缺失时整体跳过。验证：workflow 语法检查通过（ruby YAML 解析 + 各步骤 `bash -n`），核对步骤内无未定义变量（`set -u` 语义）
- [x] 1.2 在「维护 appcast 清单」步骤的 GitHub 分支推送后追加 OSS 上传（`releases/macos/appcast.xml`）+ 匿名探测；失败时删除 OSS 旧 appcast 并记录，GitHub 分支推送行为保持不变。验证：语法检查通过；步骤条件仍为 `sparkle_enabled` 时执行

## 2. Android 客户端：OSS 清单优先与回退

- [x] 2.1 `GithubReleaseClient.latestForPlatform` 增加 OSS 固定清单优先：先 GET `releases/android/update.json`（5 秒超时），成功直接解析返回且不再查询 GitHub Releases 列表；网络错误/非 200/解析失败回退既有 GitHub 链路，回退链路错误语义不变。验证：单测断言 OSS 命中路径不再发起 GitHub 列表请求、各失败形态均进入回退
- [x] 2.2 更新 `github_release_client` 既有单测（新增 OSS 探测请求的 mock 分支，保证既有断言仍成立）并补充新场景单测。验证：`flutter test` 全量通过

## 3. macOS 客户端：Sparkle feed 探测与回退

- [x] 3.1 `MacosSparkleUpdater.initialize` 增加 feed 解析：先 GET `releases/macos/appcast.xml`（5 秒超时），200 时以 OSS 地址 `setFeedURL`，否则回退 GitHub raw 地址；探测客户端支持注入以便测试。验证：单测断言两种路径下 `setFeedURL` 收到的地址正确
- [x] 3.2 更新 `macos_sparkle_updater` 既有单测并补充探测回退场景。验证：`flutter test` 全量通过

## 4. 文档同步

- [x] 4.1 更新 `docs/技术文档.md` 发布分发链路：新增更新发现链路说明（OSS 固定路径清单/appcast、覆盖式指针、失败删指针回退规则、客户端优先与回退、存量客户端与 GitHub 兜底不变）。验证：文档描述与 `release.yml` 及客户端实现一致

## 5. 端到端验证

- [x] 5.1 触发一次发布并验证：发布日志显示清单/appcast 上传与匿名探测通过；`curl` 匿名访问 `releases/android/update.json`、`releases/macos/update.json`、`releases/macos/appcast.xml` 均返回 200 且内容为本次发布版本
  - 验证结果（run 38844534375，发布 android/v1.0.12、macos/v1.0.16）：流水线「上传 OSS 更新清单」日志显示两平台探测 200 并上传，「维护 appcast 清单」显示 appcast 探测 200；匿名 curl 三路径均 200 且版本为本次发布（安卓清单 url 指向 `.bin`、macOS appcast 最新 item 为 1.0.16、其 Sparkle zip enclosure 指向 OSS 且匿名 range 请求 206）
- [ ] 5.2 Android 验证：用包含本变更的版本检查更新，确认日志显示 OSS 清单命中且更新链路正常；删除 OSS 指针后再次检查，确认回退 GitHub 链路正常（验证后恢复指针或等下一次发布覆盖）
- [ ] 5.3 macOS 验证：确认 feed 探测日志显示 OSS 优先；模拟 OSS appcast 不可用（删除对象）时回退 GitHub feed 正常，随后恢复

## Workflow follow-up

- 归档本 change（`openspec archive oss-update-feed`），将 delta 同步进主规格（`per-platform-release`、`release-update-management`、`sparkle-auto-update`）
- 归档后确认主仓库文档与 submodule 指针均已落盘
