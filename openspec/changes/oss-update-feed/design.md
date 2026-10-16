# Design

## Context

现有更新发现链路（见 proposal.md - Why）：

- Android：客户端调 GitHub Releases 列表 API → 取版本号最高的 `android/` 发布 → 下载该 Release 的 `private-domain-drive-update.json` → 按清单 `url` 下载 APK（大文件已是 OSS `.bin` 直链或 GitHub 回退）。
- macOS：Sparkle 通过 Dart 层 `setFeedURL`（`auto_updater` 插件）读取 GitHub raw 的 `appcast.xml`，enclosure 已指向 OSS zip。
- 下载 URL 不写死在客户端：任何版本都在检查时实时读取最新清单/appcast，但「发现最新版本」这一步目前必须经过 GitHub。

约束与已有条件：

- OSS `releases/` 前缀公开读、专用凭证 `pdd-release-oss` 已有 `PutObject` / `GetObject` / `DeleteObject` 权限，无需新增密钥。
- 发布流水线 release job 已安装 ossutil（`OSSUTIL_BIN` 经 `GITHUB_ENV` 跨步骤可用），已具备上传与匿名探测的现成辅助函数。
- 客户端 `auto_updater` 支持运行时 `setFeedURL`；Android 清单解析逻辑（`GithubRelease.fromJson`）可直接复用同一份清单格式。

## Goals / Non-Goals

**Goals:**

- 更新发现（Android 清单、macOS appcast）优先走 OSS 固定路径，国内即点即得。
- 任一 OSS 环节失败可回退 GitHub，且发布流水线不因 OSS 失败而失败。
- 新客户端在 OSS 指针尚未生成（首次发布前）时行为正确：探测失败自动走 GitHub。

**Non-Goals:**

- 不彻底切断 GitHub：Releases 清单资产与 `appcast` 分支继续维护，承担存量客户端发现链路与回退。
- 不改 APK/DMG/zip 下载地址生成规则（由 `oss-release-mirror` 变更完成）。
- 不引入 CDN、自定义域名或对象版本控制。
- 不改服务端 FC 与文件业务链路。

## Decisions

### 1. 固定路径与覆盖式指针

- `releases/<platform>/update.json`：各平台最新清单覆盖式指针（`Content-Type: application/json`，公开读）。
- `releases/macos/appcast.xml`：macOS Sparkle feed 副本。
- 用固定路径而非版本化目录：客户端需要稳定 URL 才能不依赖列表 API；版本化目录继续只存不可变资产。macOS 清单当前无客户端消费者（Sparkle 链路），一并上传以保持目录结构与规则对称、便于人工核查。
- 备选：版本化 manifest 路径（否决，仍需列表发现）；OSS 对象版本控制（否决，增加复杂度无收益）。

### 2. 失败处理：上传失败即移除旧指针

- 若上传失败仍保留旧指针，客户端会读到过期清单并静默误报「已是最新」——比"慢"更糟。因此清单/appcast 上传或匿名探测不通过时，**删除 OSS 上的旧对象**：客户端请求 404 → 自动回退 GitHub 链路，行为正确（只是回到现状速度）。
- 删除同样失败时残留旧指针：偶发滑窗，下一次成功发布覆盖自愈；GitHub 侧权威数据不受影响。
- 该规则利用已有 `DeleteObject` 权限，无需扩权。

### 3. 客户端优先级与回退

- Android（`GithubReleaseClient.latestForPlatform`）：先 GET `releases/android/update.json`（5 秒超时），成功 → 直接解析返回（**不再调 GitHub 列表**）；网络错误/非 200/解析失败 → 走既有 GitHub Releases 列表链路，回退链路的错误语义不变（两者都失败才按检查失败处理）。
- macOS（`MacosSparkleUpdater.initialize`）：先 GET `releases/macos/appcast.xml` 探测（5 秒超时），200 → `setFeedURL(OSS 地址)`；否则 `setFeedURL(GitHub raw 地址)`。feed 选择全在 Dart 层完成，`auto_updater` 已支持动态设置，无需改 Swift/Info.plist。
- 超时取舍：OSS 探测 5 秒（清单/appcast 均为 KB 级，超时即视为不可用）；GitHub 链路保持 10 秒。最坏路径 5 + 10 + 10 = 25 秒，仍在既有失败文案跨度内。
- 代理：OSS 与 GitHub 请求沿用同一系统代理解析规则（与既有规格「更新检查请求经系统代理」一致），不引入直连特例，减少行为面。
- 复用清单格式：OSS 指针与 GitHub Release 附带的清单由同一生成器产出、结构一致，解析逻辑零改动。

### 4. 流水线接入点

- 新增步骤「上传 OSS 更新清单」，位于「生成平台更新清单」之后：上传 `dist/<platform>/private-domain-drive-update.json` → `releases/<platform>/update.json` + 匿名探测；失败则 `rm` 旧指针并记录，不中断发布。
- 「维护 appcast 清单」步骤末尾（GitHub 分支推送后）追加 OSS 上传 + 探测 + 失败删除；步骤条件不变（仅 `sparkle_enabled` 时）。
- 复用已安装的 ossutil 与配置；凭证缺失时整体跳过（与既有镜像链路同规则）。清单上传与 `OSS_MIRROR_*_OK` 资产镜像标记相互独立：清单内容已包含资产 URL 的回退选择，此处只是"指针搬运"。

### 5. 切换与存量兼容

- 流水线与本 change 客户端代码同批发布。发布前 OSS 指针不存在 → 新客户端探测 404 → 回退 GitHub（无缝）；发布后指针生成 → 新客户端走 OSS。
- 存量客户端（旧发现逻辑）不受影响；升级到「OSS 优先」版本这一步仍走 GitHub 发现，无法避免，GitHub 兜底因此必须保留。

## Risks / Trade-offs

- [上传与删除双失败 → 旧指针残留，客户端暂以旧清单为准] → 需 OSS 部分故障，概率极小；下一次成功发布覆盖自愈；GitHub 侧不受影响。
- [探测是额外请求 → 小文件双倍流量] → 清单/appcast 均为 KB 级，可忽略。
- [存量客户端升到新链路版本的第一步仍依赖 GitHub] → 客观限制（发现逻辑在旧包内）；GitHub 保持兜底，且大文件早已 OSS。
- [OSS 指针被误删 → 客户端回退 GitHub] → 行为正确（只是慢），无需处理。
- [固定路径被中间层缓存 → 读到旧清单] → 全链路 HTTPS + OSS 直连无 CDN 缓存，无中间缓存面；忽略。

## Migration Plan

1. `release.yml` 与客户端代码、单测、文档同批合并 client master。
2. 触发一次发布：检查清单/appcast 上传与探测日志；匿名 `curl` 验证 `releases/<platform>/update.json` 与 `releases/macos/appcast.xml` 返回 200 且内容为最新版本。
3. 用包含新逻辑的构建验证：Android 检查更新日志显示 OSS 清单命中；删除指针（或模拟不可用）验证回退 GitHub；macOS 验证 feed 探测与 Sparkle 检查链路。
4. 回滚：revert 客户端与流水线改动即可；OSS 指针对象无需清理（新旧客户端均按不可用/不读取处理）。
