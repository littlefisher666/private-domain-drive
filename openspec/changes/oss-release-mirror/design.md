# Design

## Context

发布流水线在 client 仓库 `.github/workflows/release.yml`：构建 APK/DMG/Sparkle zip → 创建 GitHub Releases → 生成 `private-domain-drive-update.json`（资产 url 拼接自 `RELEASE_BASE_URL`）→ 维护 `appcast` 分支的 `appcast.xml`（enclosure 指向 GitHub Release 下载地址）。动机见 proposal.md - Why。

已知事实（本提案期间实测）：

- GitHub 美国 runner 直传杭州 OSS 约 20 MB/s（100MB 文件约 5 秒），链路不是瓶颈。
- `pdd-server` 密钥仅授权 `config/users.json`，`pdd-client` 密钥授权 `shared/` 前缀，均不适用于发布目录，需要专用凭证。
- ossutil v1.7.18 linux-amd64 在 GitHub runner 上验证可用（注意解压后二进制位于版本号子目录中）。

## Goals / Non-Goals

**Goals:**

- 发布资产在国内可通过 OSS 公开读直链高速下载。
- OSS 镜像仅作为加速手段，任何镜像环节失败都不影响发布本身（回退 GitHub）。
- 凭证权限最小化：专用 RAM 密钥只覆盖 `releases/` 前缀。

**Non-Goals:**

- 不改客户端更新检查链路（Releases 列表、update.json、appcast.xml 本身仍走 GitHub，均为小文件）。
- 不引入 CDN、备案域名或自定义域名。
- 不迁移历史 appcast item 的下载地址（Sparkle 只下载最新 item，历史地址无需迁移）。
- 不让 FC 参与发布分发（维持一期"FC 不承担文件流量"约束）。

## Decisions

### 1. 对象布局与公开读方式

- 布局：`releases/<platform>/<version>/<asset-name>` 三级目录，与 Maven 仓库 GAV 目录存储方式一致；同一版本的多个资产（DMG/zip 或后续镜像的清单文件）聚合在同一目录，历史版本按目录即可整体定位与清理。同名重复发布会覆盖旧对象（对象 key 相同）。
- 公开读：上传时对对象设置 public-read ACL，无需签名 URL。发布资产本就需要公开分发，公开读不引入信息泄露面。
- 下载地址：OSS 默认域名 `https://private-domain-drive.oss-cn-hangzhou.aliyuncs.com/releases/android/1.2.3/private-domain-drive-android-v1.2.3.apk`，无需备案。
- 备选：CDN + 自定义域名（需 ICP 备案，一期规模无收益）；签名 URL（带过期时间，会破坏"清单长期有效"，不可选）。

### 2. 凭证方案

- 新建 RAM 用户 `pdd-release-oss`，自定义策略仅授权 `acs:oss:*:*:private-domain-drive/releases/*` 的 `PutObject` / `GetObject` / `DeleteObject`。
- 密钥存入 client 仓库 Secrets：`PDD_RELEASE_OSS_ACCESS_KEY_ID` / `PDD_RELEASE_OSS_ACCESS_KEY_SECRET`，并备份到主仓库 `secrets/github-actions-secrets.env`（git-crypt 加密）。
- 备选：复用 `pdd-client` 密钥（授权面过大且该密钥会下发到所有客户端，泄露风险高，否决）；`pdd-server` 密钥（策略仅限 users.json，实测其他前缀 403，不可用）。

### 3. 流水线接入点与回退策略

- 在 release job 中、"生成平台更新清单"步骤之前插入"上传 OSS 镜像"步骤：用 ossutil 将本次发布资产上传到 `releases/` 前缀，`--acl public-read --bigfile-threshold=10 --jobs=4`。
- 按平台分别记录成功标记（`OSS_MIRROR_ANDROID_OK` / `OSS_MIRROR_MACOS_OK`），Android 失败不影响 macOS 镜像。
- 生成 update.json 与 appcast 时按标记选择 base url：镜像成功用 `OSS_MIRROR_BASE_URL`，否则回退 `RELEASE_BASE_URL`。上传步骤失败不中断流水线（脚本内捕获或 `continue-on-error`）。
- appcast 新 item 的 `<link>` 保持指向 GitHub Release tag 页面（更新说明展示），仅 enclosure（实际下载地址）切换 OSS。
- 备选：上传失败直接阻断发布（保证清单一致性但把"国内加速"变成发布硬依赖，违背 Goals，否决）。

### 4. 摘要与归档一致性

- 上传 OSS 与挂载 GitHub Release 的是同一批 `dist/` 文件，SHA-256 摘要已在上传前计算，两侧下载地址共用同一摘要值，天然满足"镜像与归档一致性"。
- GitHub Release 继续挂载原始资产，作为归档与手动下载兜底（更新检查失败时客户端仍打开 GitHub Releases 页面）。

## Risks / Trade-offs

- [OSS 对象被误删 → 已发布清单的直链 404，回退机制只覆盖发布时刻] → 发布完成后不清理 `releases/` 对象；删除权限只授予专用密钥，误删概率低。一期可接受，后续可加生命周期规则或校验步骤。
- [专用密钥泄露 → 攻击者可篡改发布目录] → 权限最小化（仅 releases/ 前缀、无列举权限），泄露影响面限于发布资产；密钥仅存于 GitHub Secrets 与 git-crypt 备份。
- [跨境上传波动导致偶发回退] → 实测 20 MB/s 且失败自动回退 GitHub，用户体验退化为现状而非中断。
- [公开读对象无防盗链，可能被外链盗用流量] → 一期用户规模极小、费用可忽略；后续需要时平滑加 CDN（仅替换 base url），不改流水线结构。

## Migration Plan

1. 在阿里云 RAM 控制台创建 `pdd-release-oss` 用户与密钥，配置最小策略；密钥写入主仓库 secrets 备份文件。
2. 在 client 仓库配置 `PDD_RELEASE_OSS_*` Secrets。
3. 修改 `release.yml` 增加镜像上传与 URL 选择逻辑，合并到 master。
4. 触发一次 `both` 发布做端到端验证：检查 OSS 对象存在且公开可下载、update.json 与 appcast 中 URL 为 OSS 直链、国内网络实测下载速度。
5. 回滚方案：revert `release.yml` 改动即可恢复纯 GitHub 发布；已发布版本的清单 URL 不回滚（OSS 对象保留，直链持续有效）。
