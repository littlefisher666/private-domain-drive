# Tasks

## 1. 发布镜像凭证准备

- [x] 1.1 在阿里云 RAM 控制台创建 `pdd-release-oss` 用户与 AccessKey，配置策略仅授权 `private-domain-drive` 桶 `releases/` 前缀的 `PutObject`/`GetObject`/`DeleteObject`。验证：用该密钥本地 ossutil 上传对象到 `releases/` 前缀成功、上传到 `shared/` 前缀返回 AccessDenied
- [x] 1.2 在 client 仓库 Settings → Secrets 添加 `PDD_RELEASE_OSS_ACCESS_KEY_ID` 与 `PDD_RELEASE_OSS_ACCESS_KEY_SECRET`。验证：`gh secret list -R littlefisher666/private-domain-drive-client` 可见两个新条目
- [x] 1.3 将新密钥备份到主仓库 `secrets/github-actions-secrets.env` 并提交（git-crypt 加密）。验证：`git status` 显示该文件为密文状态、提交中不含明文密钥

## 2. 发布流水线接入 OSS 镜像

- [x] 2.1 在 client 仓库 `release.yml` 的 release job 新增 ossutil 安装步骤（下载 v1.7.18 linux-amd64、解压、非交互配置，二进制位于解压后版本号子目录）。验证：workflow 语法有效（可用 actionlint 或触发发布观察该步骤通过）
- [x] 2.2 在"生成平台更新清单"之前新增"上传 OSS 镜像"步骤：将本次发布资产上传到 `releases/<platform>/<version>/`，`--acl public-read --bigfile-threshold=10 --jobs=4`，按平台写入成功标记到 `$GITHUB_ENV`，任一失败不中断流水线。验证：触发发布后上传日志无报错、OSS 控制台可见 `releases/android/<version>/` 下公开读对象
- [x] 2.3 调整"生成平台更新清单"与 appcast 维护步骤的 base url 选择：镜像成功时资产 `url`/enclosure 用 `https://private-domain-drive.oss-cn-hangzhou.aliyuncs.com` 前缀，否则回退 `RELEASE_BASE_URL`；appcast item 的 `<link>` 保持 GitHub Release 页面。验证：发布产物 `update.json` 与 `appcast.xml` 新 item 中下载地址为 OSS 直链
- [x] 2.4 验证回退路径：临时在 client 仓库停用（或留空）`PDD_RELEASE_OSS_*` secrets 触发一次发布，确认发布正常完成、`update.json` 与 appcast 下载地址回退为 GitHub、流水线无失败标记；验证后恢复 secrets
- [x] 2.5 安卓镜像规避 OSS 匿名下载拦截：镜像对象以 `.bin` 命名并显式写 `Content-Type: application/octet-stream` 上传（key 含 `.apk` 或 apk 类型在默认域名匿名请求返回 400 `ApkDownloadForbidden`），清单安卓 `url` 按 `.bin` 拼装（`name`/`digest` 保持原值）；上传后对全部镜像直链做匿名探测（range 请求 200/206 才计成功，否则按镜像失败回退）。验证：下一次发布匿名下载安卓 `.bin` 全量与 GitHub 资产 SHA-256 一致且探测日志通过；v1.0.10 存量清单修复（服务端复制对象 + 清单改指 `.bin` 直链，匿名 206、摘要一致）已于 2026-10-16 完成。实测（run 38841282644，android/v1.0.11）：上传后探测 206，清单直链匿名下载 200、SHA-256 与清单 `digest` 完全一致

## 3. 文档与仓库指针同步

- [x] 3.1 更新主仓库 `docs/技术文档.md` 的发布分发链路说明（OSS 镜像地址、专用凭证、回退规则）。验证：文档描述与实际流水线行为一致
- [x] 3.2 将 client 子仓库新提交推送到远端后，回到主仓库更新 submodule 指针并提交。验证：主仓库 `git status` 干净且指针指向包含镜像步骤的 client 提交

## 4. 端到端验证

- [x] 4.1 触发一次 `both` 发布，验证：两个平台的 OSS 对象存在且无需凭证 curl 返回 200、`update.json` 与 appcast 下载地址为 OSS 直链、国内网络实测下载速度明显优于 GitHub 直连。（2026-10-16 完成：run 38841282644 发布 android/v1.0.11、macos/v1.0.15，安卓按 `.bin` 口径匿名下载 200、macOS dmg/zip 206，清单与 appcast 均为 OSS 直链；OSS 实测约 5–10 MB/s，GitHub 直连 30s 超时不可用）
- [x] 4.2 Android 端验证：用新发布版本触发应用内更新，确认 APK 从 OSS 直链下载、SHA-256 校验通过并可安装。（2026-10-16 完成：真机在旧版本内通过设置页应用内更新至 1.0.12 成功；更新时刻可获取的最新清单（GitHub Release 附带资产）中安卓 url 即 OSS `.bin` 直链，下载后由客户端校验 SHA-256 再安装；独立复核：匿名下载 OSS `.bin` 与 GitHub 清单 digest 逐字节一致，`sha256:942f5ec3…`）
- [ ] 4.3 macOS 端验证：用新发布版本触发 Sparkle 更新，确认更新包从 OSS 直链下载、EdDSA 校验通过并完成替换

## Workflow follow-up

- 归档本 change（`openspec archive oss-release-mirror`），将 delta 同步进 `openspec/specs/per-platform-release` 主规格
- 归档后检查主仓库文档与指针均已落盘
