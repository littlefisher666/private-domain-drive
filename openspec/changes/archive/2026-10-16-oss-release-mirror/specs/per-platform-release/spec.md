# Spec Delta

## MODIFIED Requirements

### Requirement: 按平台拆分发布产物
每个平台 Release SHALL 只包含该平台的发布资产与清单：Android Release SHALL 包含 `private-domain-drive-android-vX.Y.Z.apk`，macOS Release SHALL 包含 `private-domain-drive-macos-vX.Y.Z.dmg` 与 Sparkle 更新包 `private-domain-drive-macos-vX.Y.Z.zip`；各 Release 附带的 `private-domain-drive-update.json` SHALL 仅包含 `version`（该平台版本）与该平台一个资产字段。GitHub Release SHALL 继续挂载原始资产作归档与手动下载兜底；清单中资产的下载地址 SHALL 指向 OSS 发布镜像直链，镜像不可用时回退 GitHub Release 下载地址。

#### Scenario: Android Release 清单结构
- **WHEN** Android 平台 Release 创建完成
- **THEN** 其 update.json 的 `assets` SHALL 仅含 `android` 字段，且 `version` 等于该平台 tag 的版本号，资产 `url` SHALL 为 OSS 镜像直链或回退的 GitHub Release 下载地址

#### Scenario: macOS Release 资产结构
- **WHEN** macOS 平台 Release 创建完成
- **THEN** 该 Release SHALL 同时挂载 DMG（首次安装用）与 zip（Sparkle 更新载荷），zip SHALL 由 `.app` 以保留扩展属性与签名元数据的方式打包

#### Scenario: 两端同时发布
- **WHEN** `platforms` 为 `both` 且构建成功
- **THEN** 流水线 SHALL 创建两个独立的 Release（tag 分别为 `android/vX.Y.Z` 与 `macos/vX.Y.Z`），各自只挂载本平台资产与清单

### Requirement: macOS appcast 维护
发布流水线 SHALL 在每次 macOS 发版时用 Sparkle `sign_update` 以 EdDSA 私钥对更新包 zip 签名，并将新 item（版本号、zip 下载地址、EdDSA 签名、文件长度、更新说明）合并进托管于客户端仓库 `appcast` 分支固定路径的 `appcast.xml`；appcast SHALL 保留全部历史 item 以支持跨版本升级，EdDSA 私钥 SHALL 仅存在于仓库 Secret 与本地备份，SHALL NOT 写入源码或提交仓库。新 item 的 zip 下载地址 SHALL 为 OSS 发布镜像直链，镜像不可用时回退 GitHub Release 下载地址；历史 item 的下载地址 SHALL 保持原值不变。

#### Scenario: 发版生成新 item
- **WHEN** macOS Release 创建成功
- **THEN** 流水线 SHALL 以本次 zip 资产的 OSS 镜像直链（镜像不可用时回退 Release 下载地址）、EdDSA 签名与版本号生成新 item，合并进 `appcast.xml` 并推送到 `appcast` 分支

#### Scenario: 历史 item 保留
- **WHEN** 本次发版合并新 item
- **THEN** `appcast.xml` SHALL 保留此前全部 item，旧版本客户端 SHALL 能沿 appcast 链路升级到最新版本

#### Scenario: 签名步骤失败不阻塞 DMG 发布
- **WHEN** zip 打包或 `sign_update` 签名在流水线中失败
- **THEN** 流水线 SHALL 允许本次 Release 仅以 DMG 完成（该版本不具备自更新触达能力），SHALL NOT 因 Sparkle 产物失败丢弃 DMG 发布

## ADDED Requirements

### Requirement: OSS 发布镜像上传
发布流水线 SHALL 在生成平台更新清单与 appcast 之前，使用仅授权 OSS `releases/` 前缀的专用凭证将本次发布资产上传至发布镜像目录（公开读）；上传成功时更新清单资产地址与 appcast 新 item 下载地址 SHALL 指向镜像直链；上传失败或凭证缺失时 SHALL 回退 GitHub Release 下载地址且发布流程 SHALL NOT 因此失败。发布镜像 SHALL NOT 使用服务端读写凭证或下发给客户端的业务凭证。

#### Scenario: 镜像上传成功
- **WHEN** 发布流水线将本次发布资产成功上传至 OSS 发布镜像目录
- **THEN** update.json 资产 `url` 与 appcast 新 item 的 zip 下载地址 SHALL 为该资产的 OSS 公开读直链，直链无需任何登录或签名即可下载

#### Scenario: 镜像上传失败
- **WHEN** OSS 上传失败（网络错误、鉴权失败等）
- **THEN** 流水线 SHALL 回退为 GitHub Release 下载地址生成清单与 appcast，发布 SHALL 照常完成且不标记失败

#### Scenario: 镜像凭证缺失
- **WHEN** 发布流水线未配置镜像上传凭证
- **THEN** 流水线 SHALL 跳过镜像上传，按 GitHub Release 下载地址完成发布，SHALL NOT 报错中断

#### Scenario: 镜像与归档一致性
- **WHEN** 同一版本资产同时存在于 OSS 镜像与 GitHub Release
- **THEN** 两侧文件 SHALL 为同一构建产物，清单中的 SHA-256 摘要 SHALL 对两侧下载地址均有效

### Requirement: 安卓镜像对象匿名下载规避
安卓 APK 镜像对象 SHALL 以不含 `.apk` 子串的对象名（`.bin`）与 `Content-Type: application/octet-stream` 上传（OSS 默认域名对键名含 `.apk` 或 apk 类型的对象拦截匿名下载，返回 400 `ApkDownloadForbidden`）；清单中安卓资产 `url` SHALL 指向该 `.bin` 对象，`name` 与 `digest` SHALL 保持与原始 APK 一致。

#### Scenario: 安卓镜像规避 OSS 匿名下载拦截
- **WHEN** 发布流水线镜像 Android 资产
- **THEN** OSS 上安卓镜像对象 SHALL 以 `.bin` 命名且 `Content-Type` 为 `application/octet-stream`，匿名请求该直链 SHALL 可完整下载，下载字节的 SHA-256 SHALL 与清单 `digest`（原始 APK 摘要）一致，清单安卓 `name` SHALL 仍为 `.apk` 以保证客户端本地保存文件名与安装流程不变

### Requirement: 镜像直链匿名自检
发布流水线 SHALL 在每个平台资产上传后以匿名请求探测镜像直链（range 请求返回 200/206 视为通过）；探测未通过 SHALL 与上传失败同等处理（按回退规则使用 GitHub 下载地址），发布 SHALL NOT 失败。

#### Scenario: 镜像直链匿名探测
- **WHEN** 发布流水线完成某平台资产上传
- **THEN** 流水线 SHALL 以无凭证请求探测镜像直链，探测未返回 200/206 时 SHALL 将该平台判定为镜像失败并按回退规则使用 GitHub 下载地址
