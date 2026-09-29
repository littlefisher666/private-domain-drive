## 1. 客户端：更新检查改造（先行合入，安全降级）

- [x] 1.1 在 `client/lib/features/settings/infrastructure/github_release_client.dart` 中新增 Releases 列表查询：`GET https://api.github.com/repos/littlefisher666/private-domain-drive-client/releases?per_page=30`，按当前平台前缀（`android/` / `macos/`）过滤 tag，取第一条匹配 Release
- [x] 1.2 匹配到 Release 后下载其 `private-domain-drive-update.json` 资产，复用现有 `GithubRelease.fromJson` 解析版本、说明与资产摘要
- [x] 1.3 无任何平台前缀匹配的 Release 时返回空结果，由 `update_service.dart` 按已有"当前已是最新版本"路径处理，不抛错
- [x] 1.4 更新 `client/lib/features/settings/application/update_service.dart` 的版本比较来源与本端资产匹配逻辑，对齐 `release-update-management` delta 规格各场景
- [x] 1.5 更新与新增单元测试（`client/test/update_service_test.dart` 等）：覆盖"另一端单独发版不提示""本平台最新 Release 无更新""无平台匹配 Release 静默""清单缺本端资产不视为可更新"等场景
- [x] 1.6 `flutter test` 全量通过；真机验证 macOS 端在旧共享 `v*` Release 环境下表现为"已是最新版本"

## 2. 流水线：release.yml 平台拆分

- [x] 2.1 `platforms` 输入：新增 `choice`（`both`/`android`/`macos`，默认 `both`）；prepare job 输出 `publish_android` / `publish_macos` 布尔值
- [x] 2.2 版本解析改造：分别查询 `android/v[0-9]*.[0-9]*.[0-9]*` 与 `macos/v[0-9]*.[0-9]*.[0-9]*` 最新 tag，缺省 `1.0.0`；按所选平台独立递增 PATCH 或取手动 `version`；输出各平台 `version_name` / `tag_name` 并回显排序结果；保留目标 tag 已存在时报错
- [x] 2.3 android / macos 构建 job 增加 `if` 条件按所选平台裁剪；构建参数中的 `--build-name` / `--build-number` 与资产命名改用对应平台的版本输出
- [x] 2.4 release job 改为按平台创建 Release：每个平台一条（tag 与 Release 名一致），只挂载本平台资产；update.json 按平台生成（`assets` 仅含该平台字段）；两端同时发布时在说明中互相链接对方 Release
- [x] 2.5 更新说明生成：commit 范围改为"上一次同平台 tag 到本次"，开头标注本次发布涉及的平台
- [x] 2.6 废止共享 `v*` tag 逻辑：不再创建 `vX.Y.Z` tag，说明文案与 step summary 同步更新

## 3. 联调验证与首次发布

- [x] 3.1 本地触发（或 fork 分支 dry-run）验证：默认 `both`、单选 `android`、手动 `version` 三种输入组合的版本解析与 job 裁剪符合预期
- [x] 3.2 首次按新流水线发布：显式填写当前最新共享版本号，选 `both`，确认 `android/v*` 与 `macos/v*` tag、双 Release、单平台 update.json 形态正确
- [x] 3.3 真机验证更新检查：Android 单端发版后 macOS 客户端不提示更新；macOS 客户端能发现并完成本端更新（DMG 引导）；Android 端应用内更新（SHA-256 校验 + 安装器）回归通过
- [x] 3.4 同步文档：更新 `docs/接口.md` / `docs/Flutter架构设计.md` 中更新检查与发布流程的相关描述

## 4. 归档

- [x] 4.1 验证完成后执行 `/opsx:archive`，将 delta 规格同步至 `openspec/specs/`
