# 设计：客户端版本发布按平台拆分版本号

## Context

当前发布链路（`client/.github/workflows/release.yml`）：

- 版本唯一来源是共享 tag `vX.Y.Z`，prepare job 按其自动递增 PATCH 或取手动输入
- 一次发布同时构建 APK 与 DMG，挂到同一个 Release，update.json 的 `assets` 固定包含 `android` 与 `macos` 两个字段
- 客户端（`client/lib/features/settings/infrastructure/github_release_client.dart`）不调用 GitHub API，而是请求静态 URL `releases/latest/download/private-domain-drive-update.json`（GitHub 重定向到最新 Release 的资产），用清单 `version` 与本端版本比较

因此单端修复发布后，另一端客户端会比较出"远端版本更高"且能找到本端资产，产生误报。

客户端现状补充：`GithubRelease.fromJson` 把 `assets` 当作 map 遍历（`assets.values`），并不依赖字段名——这为 update.json 收缩为单平台字段提供了兼容空间。

## Goals / Non-Goals

**Goals:**

- 每端版本号独立演进，单端修复不再导致另一端误报更新
- 发布操作保持简单：默认一次触发等价于现在"两端同时发版"的行为
- 客户端能准确找到"本端平台的最新发布"及其版本

**Non-Goals:**

- 不做基于变更路径的平台影响自动检测（已讨论否决，改为手动选择平台）
- 不引入数据库、外部清单服务或新的托管基础设施
- 不改变 APK 应用内安装、DMG 手动引导、SHA-256 校验等既有更新交付行为
- 不处理存量共享 `v*` tag 的迁移或删除（保留为历史记录）

## Decisions

### D1：tag 采用平台前缀命名 `android/vX.Y.Z`、`macos/vX.Y.Z`

- 前缀 + `/` + 版本的形式在 Releases/Tags 页面可读性好，且 `git tag --list 'android/v[0-9]*.[0-9]*.[0-9]*' --sort=-version:refname` 在前缀内排序正确
- 备选：仓库内版本文件（`versions/android.txt`）——多一处需要提交的状态，且 tag 天然是发布锚点，弃用
- 每次发布为每个所选平台各创建一个 tag；两端同时发版即两个 tag、两个 Release

### D2：platforms 为手动选择输入，默认 both

- `workflow_dispatch` 增加 `choice` 输入：`both`（默认）/ `android` / `macos`
- 默认值保证"不填任何输入"时行为与现状等价，避免流程迁移后忘记配置导致漏发
- 备选的路径自动检测因误判静默、映射清单需持续维护而被否决

### D3：版本递增按"所选平台各自最新 tag"独立进行

- prepare job 分别查询 `android/v*` 与 `macos/v*` 最新版本；无 tag 时缺省 `1.0.0`
- 留空 `version` 时：所选平台的版本各按自身最新 PATCH +1，两端版本不同步不强制拉齐
- 填写 `version` 时：所选平台版本统一设为该值（用于发大版本），未选平台不受影响
- tag 冲突检查沿用现状：目标 tag 已存在时报错终止

### D4：构建 job 用 needs 输出 + if 条件裁剪，而非拆分 workflow

- prepare 输出 `publish_android` / `publish_macos` 布尔值，android / macos job 以 `if` 判断是否执行；release job 对未构建平台跳过对应产物
- 备选：拆成两个独立 workflow 文件——单测、签名、发布说明等步骤全部重复，维护成本更高，弃用
- `run_tests` 输入不变：单测与平台无关，始终整体执行一次

### D5：客户端改为 GitHub API Releases 列表 + 平台前缀过滤

- 请求 `GET https://api.github.com/repos/littlefisher666/private-domain-drive-client/releases?per_page=30`（未认证，60 次/小时/IP，对单人应用足够），取第一条 tag 匹配当前平台前缀（`android/` / `macos/`）的 Release
- 版本号从 `tag_name` 解析；随后下载该 Release 的 `private-domain-drive-update.json` 资产获取更新说明与资产摘要（API 不提供 SHA-256，摘要仍以清单为准）
- 备选一：继续用静态 URL `releases/latest/download/...`——`latest` 指向最近创建的 Release（混合平台），无法表达"本端最新"，弃用
- 备选二：用可移动的 `android-stable` 指针 tag + 静态 URL——需要 force 移动 tag，多一个易错的可变状态，弃用

### D6：update.json 保持现有 schema，但只含发布平台的一个字段

- 每个平台 Release 附带自己的 `private-domain-drive-update.json`：`version` 为该平台版本，`assets` 仅含 `android` 或 `macos` 其一
- 客户端 `GithubRelease.fromJson` 按 `assets.values` 遍历，无需 schema 变更即可解析单字段清单
- 降级行为：存量客户端仍请求 `releases/latest/download/...`，会拿到最近创建的（可能单平台的）清单；若清单缺本端资产，现有"当前平台缺少资产"逻辑会判定不可更新，静默安全降级，不会误报

## Risks / Trade-offs

- [Releases 页面 android/macos 条目交错，不如单一序列整齐] → tag 前缀与 Release 名自带平台信息已足够可读，不做额外聚合视图
- [GitHub API 未认证限流 60 次/小时/IP] → 更新检查频率低（进设置页/手动触发），单人项目足够；超出时明确报"无法获取最新版本"而非误判
- [两端同时发版时一个 Release 只有单端资产，用户从网页找另一端资产需跳到另一条 Release] → Release 描述中互相链接对方本次 Release（低成本提示，不引入聚合机制）
- [首次按新流水线发布前，若先打了 `android/v1.1.0` 而存量用户客户端仍按旧逻辑检查] → 旧客户端拿到单平台清单后静默判定无更新；尽快完成新旧两端首次发布即收敛
- [`git tag --sort=-version:refname` 对带前缀 tag 的排序依赖 Git versioncmp 行为] → 在流水线 prepare 中加一个排序结果断言/回显，发布时人工可见

## Migration Plan

1. 客户端先行：合入新的更新检查逻辑（API 列表 + 前缀过滤）。此时线上仍是共享 `v*` Release，前缀匹配不到任何 Release，客户端表现为"已是最新版本"（安全降级）
2. 流水线切换：合入新版 release.yml，首次触发时显式填 `version` 为当前最新共享版本号（避免版本回退到 1.0.0），选 `both`
3. 验证新 Release / tag / update.json 形态与真机更新检查通过
4. 回滚策略：若新版流水线异常，旧版 release.yml 仍在 git 历史中可回退（共享 tag 序列未被删除，只是不再推进）

## Open Questions

无——平台选择采用手动输入、客户端取数采用 API 列表两项关键取舍均已与用户确认。
