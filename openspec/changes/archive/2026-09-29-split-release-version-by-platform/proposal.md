# 提案：客户端版本发布按平台拆分版本号

## Why

当前发布流水线使用单一共享版本 tag（`v*`），Android 与 macOS 的发布资产携带同一版本号。当某次修复只涉及一端时，另一端版本号也被动递增，导致该端客户端在更新检查时误报"有新版本"，但实际没有任何更新。需要把版本比较的依据从 Release 级别下沉到平台级别，使每端的版本号独立演进。

## What Changes

- **BREAKING** 版本 tag 拆分为两个平台序列：`android/vX.Y.Z` 与 `macos/vX.Y.Z`，不再使用共享 `vX.Y.Z` tag
- 发布流水线新增 `platforms` 选择输入（`both` / `android` / `macos`，默认 `both`），单端发布只递增该端版本、只构建该端产物、只创建该端 Release
- `version` 输入语义调整：留空时按所选平台各自最新 tag 自动递增 PATCH（选 `both` 且两端版本不同步时各自 +1，不强制拉齐）；手动填写时表示将所选平台版本设为该值
- 发布产物命名维持 `private-domain-drive-android-vX.Y.Z.apk` / `private-domain-drive-macos-vX.Y.Z.dmg`，但版本号来自对应平台 tag，两端可以不同
- 一端一个 GitHub Release（Release 名与 tag 一致），update.json 仅包含该平台字段；两端同时发版时创建两个 tag、两个 Release
- Release 更新说明的 commit 范围改为"上一次同平台 tag 到本次"，并在开头标注本次发布涉及的平台
- **BREAKING** 客户端更新检查不再依赖 `/releases/latest` 端点，改为 `GET /releases` 列表后按 `android/` / `macos/` 前缀过滤取最新，读取该 Release 的版本与本端运行版本比较
- 旧的共享 `vX.Y.Z` tag 序列废止；存量用户的客户端（仍按 Latest Release 检查）在首次按新流水线发布后需自行完成一次跨代更新

## Capabilities

### New Capabilities

- `per-platform-release`: 发布流水线按平台拆分版本号与发布产物的规则，包括平台 tag 命名、`platforms` 输入语义、版本自动递增、单端构建范围与 per-platform Release / update.json 结构

### Modified Capabilities

- `release-update-management`: 更新检查的版本来源从 "Latest Release 的清单版本" 改为 "本端平台的最新 Release 版本"；比较逻辑、资产匹配与"当前平台缺少资产"场景的行为随 per-platform Release 结构调整

## Impact

- `client/.github/workflows/release.yml`：prepare（双平台版本解析与 tag 生成）、android / macos job 的触发条件、release job（按平台生成资产、update.json 与 Release）
- `client/lib/features/settings/infrastructure/github_release_client.dart`：从 Latest Release 端点改为 Releases 列表 + 平台前缀过滤
- `client/lib/features/settings/application/update_service.dart`：版本比较来源与资产匹配逻辑
- `client/test/update_service_test.dart` 及相关测试
- `docs/接口.md` / `docs/Flutter架构设计.md` 如有更新检查相关描述需同步
- 无服务端改动；不影响 FC 接口与 OSS 凭证架构
