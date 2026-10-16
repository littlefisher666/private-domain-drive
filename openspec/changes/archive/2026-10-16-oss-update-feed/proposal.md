# Proposal

## Why

发布大文件已迁移 OSS，但更新「发现」这一步仍完全依赖 GitHub：Android 从 GitHub Releases 列表取清单，macOS Sparkle 从 GitHub raw 拉 appcast。国内网络访问 GitHub 缓慢且不稳定（实测直连超时），版本发现仍可能卡住导致用户收不到更新，削弱已完成的 OSS 加速效果。

## What Changes

- 发布流水线新增 OSS 更新清单上传：生成平台清单后将 `private-domain-drive-update.json` 上传到 `releases/<platform>/update.json`（固定路径、公开读、覆盖式最新指针）；维护 appcast 时将 `appcast.xml` 同步上传到 `releases/macos/appcast.xml`。
- 上传失败不阻塞发布：移除 OSS 上的旧指针/旧 appcast（避免客户端读到过期清单假报"已是最新"），客户端探测失败后自动回退 GitHub 链路。
- Android 客户端更新检查改为**优先拉取 OSS 固定清单**（超时 5 秒），不可用或解析失败时回退现有 GitHub Releases 列表链路，回退链路行为不变。
- macOS 客户端 Sparkle feed 改为**优先探测 OSS appcast**（超时 5 秒），不可用时回退 GitHub raw feed；`appcast` 分支继续维护，存量客户端与回退链路不受影响。
- GitHub Releases 保留为权威存档与兜底：清单资产继续挂载、appcast 分支继续推送、手动下载入口不变。
- 文档同步：`docs/技术文档.md` 发布分发链路补充更新发现链路说明。

## Capabilities

### New Capabilities

无。本变更为既有发布分发与更新检查能力的链路调整，不引入新系统能力。

### Modified Capabilities

- `per-platform-release`: 新增 OSS 更新清单与 appcast 固定路径上传要求，及上传失败时的旧指针清理与不阻塞发布规则。
- `release-update-management`: Android 更新检查增加 OSS 固定清单优先与 GitHub 回退；请求超时要求补充 OSS 清单请求项。
- `sparkle-auto-update`: macOS Sparkle feed 地址解析增加 OSS appcast 优先与 GitHub feed 回退。

## Impact

- `client/.github/workflows/release.yml`：新增 OSS 更新清单上传步骤，扩展 appcast 维护步骤同步上传 OSS。
- `client` 客户端代码：`github_release_client.dart`（Android 清单 OSS 优先）、`macos_sparkle_updater.dart`（feed 探测与回退）及对应单元测试。
- 阿里云 OSS：新增 `releases/<platform>/update.json` 与 `releases/macos/appcast.xml` 对象；复用 `pdd-release-oss` 凭证，无需新增权限。
- 主仓库：`docs/技术文档.md` 更新发现链路说明。
- 无新密钥、无服务端 FC 改动、无客户端 UI 交互变化。
