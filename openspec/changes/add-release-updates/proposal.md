## Why

客户端目前没有升级管理能力，且应用内展示和上报的版本号为硬编码，无法可靠地识别已安装版本或引导用户获取 GitHub Releases 中的新版本。项目采用非应用商店分发，需为 Android 与 macOS 建立适合直装包的升级路径。

## What Changes

- 新增基于 GitHub Releases 的稳定版更新检查、版本比较和更新说明展示。
- 将客户端运行版本改为从已安装包读取，统一用于界面展示、FC 请求和更新比较。
- Android 下载与校验 Release APK 后交由系统安装器完成覆盖安装。
- macOS 提供 DMG 下载与手动替换应用的引导，不尝试绕过 Gatekeeper 或在未签名条件下自更新。
- 将正式发布工作流调整为可配置的 Android 发布签名，并发布 macOS DMG。

## Capabilities

### New Capabilities

- `release-update-management`: 检测 GitHub Release、展示版本信息，并按 Android 与 macOS 的分发限制引导更新。
- `runtime-app-version`: 从安装包读取并对外提供当前运行版本。

### Modified Capabilities

<!-- None. -->

## Impact

- 客户端：启动组装、设置页、认证请求、网络与平台适配代码。
- 发布：GitHub Actions Release 工作流和发布资产格式。
- 新增 Flutter 运行版本读取、APK 下载与安装相关依赖；GitHub API 将作为公开的更新元数据来源。
