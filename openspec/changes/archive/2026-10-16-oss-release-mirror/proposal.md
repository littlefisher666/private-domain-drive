# Proposal

## Why

当前客户端发布资产（APK/DMG/Sparkle zip）只托管在 GitHub Releases，国内用户直连 GitHub 下载速度慢且不稳定。项目已有杭州 OSS 桶与凭证体系，且已实测 GitHub runner 直传 OSS 约 20 MB/s，可在发布流水线中低成本增加 OSS 镜像，让更新清单与 Sparkle appcast 的下载地址指向 OSS 直链，提升国内分发体验。

## What Changes

- 发布流水线新增 OSS 镜像上传步骤：将本次发布产物上传到 `private-domain-drive` 桶的 `releases/` 前缀（公开读）。
- `private-domain-drive-update.json` 的资产 `url` 与 Sparkle appcast 新 item 的 enclosure URL 指向 OSS 直链；OSS 上传失败或密钥缺失时回退 GitHub Release 下载地址，发布 SHALL NOT 因此失败。
- GitHub Releases 保留：资产仍挂载于各平台 Release 作归档与手动下载兜底；更新检查链路（Releases 列表、update.json、appcast.xml 本身）仍走 GitHub，仅大文件下载切换到 OSS。
- 新增专用 RAM 密钥 `pdd-release-oss`，授权范围仅限该桶 `releases/` 前缀，凭证存入 client 仓库 Secrets，并备份到主仓库加密 secrets 文件。
- 客户端代码无行为变化：下载地址本就取自清单/appcast 字段。

## Capabilities

### New Capabilities

无。本变更不引入新的系统能力，仅为发布流水线的分发地址规则调整。

### Modified Capabilities

- `per-platform-release`: 发布产物拆分、update.json 资产 URL、appcast 新 item 下载地址的生成规则变化——增加 OSS 镜像上传要求与 GitHub 回退规则。

## Impact

- `client/.github/workflows/release.yml`：release job 新增 ossutil 安装与 OSS 上传步骤，调整 update.json 与 appcast 的 URL 生成逻辑。
- 阿里云 RAM：新增 `pdd-release-oss` 用户与密钥，策略仅授权 `private-domain-drive` 桶 `releases/` 前缀。
- 阿里云 OSS：`private-domain-drive` 桶新增 `releases/` 前缀公开读对象（无需备案域名或 CDN）。
- client 仓库 Secrets：新增 `PDD_RELEASE_OSS_ACCESS_KEY_ID` / `PDD_RELEASE_OSS_ACCESS_KEY_SECRET`。
- 主仓库：更新 `secrets/github-actions-secrets.env` 备份与 `docs/技术文档.md` 发布分发链路说明。
- 客户端代码、服务端 FC、业务文件链路：无改动。
