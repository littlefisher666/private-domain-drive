## Purpose

定义客户端发布流水线按平台拆分版本号、tag 与 Release 的规则，避免单端发版导致另一端版本号被动递增与误报更新。

## Requirements

### Requirement: 平台版本 tag 命名
发布流水线 SHALL 为每个平台维护独立的版本 tag 序列，格式为 `android/vX.Y.Z` 与 `macos/vX.Y.Z`，并 SHALL NOT 再创建共享的 `vX.Y.Z` 版本 tag。

#### Scenario: 首次发布无历史 tag
- **WHEN** 流水线启动且不存在对应平台的任何版本 tag
- **THEN** 流水线 SHALL 以 `1.0.0` 作为该平台当前版本

#### Scenario: 目标平台 tag 已存在
- **WHEN** 解析出的目标平台版本 tag 已存在
- **THEN** 流水线 SHALL 报错终止且不创建任何 Release

### Requirement: 发布平台选择输入
发布流水线 SHALL 提供 `platforms` 手动选择输入，取值为 `both`、`android`、`macos`，默认值为 `both`；流水线 SHALL 只构建、只递增版本并只为所选平台创建 Release。

#### Scenario: 默认触发全平台发布
- **WHEN** 触发流水线且未选择 `platforms`
- **THEN** 流水线 SHALL 等价于选择 `both`，构建两端并创建两个平台 Release

#### Scenario: 仅选择 Android
- **WHEN** 触发流水线且 `platforms` 选择 `android`
- **THEN** 流水线 SHALL 只递增并创建 `android/v*` tag、只构建 APK，且 SHALL NOT 递增 `macos` 版本、SHALL NOT 构建 DMG 或创建 macOS Release

### Requirement: 版本号按平台独立递增
发布流水线 SHALL 按所选平台各自最新的平台版本 tag 独立解析当前版本并自动递增 PATCH，不同平台版本不同步时 SHALL NOT 强制拉齐；用户手动填写 `version` 时，流水线 SHALL 将所选平台版本设为该值，未选平台 SHALL 不受影响。

#### Scenario: 两端版本不同步时自动递增
- **WHEN** `platforms` 为 `both`、`version` 留空，且 `android` 最新为 `1.2.4`、`macos` 最新为 `1.2.3`
- **THEN** 流水线 SHALL 发布 `android/v1.2.5` 与 `macos/v1.2.4`

#### Scenario: 手动指定版本
- **WHEN** `platforms` 为 `both` 且 `version` 填写 `2.0.0`
- **THEN** 流水线 SHALL 将两端版本均设为 `2.0.0` 并创建 `android/v2.0.0` 与 `macos/v2.0.0`

### Requirement: 按平台拆分发布产物

每个平台 Release SHALL 只包含该平台的发布资产与清单：Android Release SHALL 包含 `private-domain-drive-android-vX.Y.Z.apk`，macOS Release SHALL 包含 `private-domain-drive-macos-vX.Y.Z.dmg` 与 Sparkle 更新包 `private-domain-drive-macos-vX.Y.Z.zip`；各 Release 附带的 `private-domain-drive-update.json` SHALL 包含 `version`（该平台版本）、该平台一个资产字段与 `minSupportedVersion`（最低支持版本，缺省或为空表示不限制）。GitHub Release SHALL 继续挂载原始资产作归档与手动下载兜底；清单中资产的下载地址 SHALL 指向 OSS 发布镜像直链，镜像不可用时回退 GitHub Release 下载地址。

#### Scenario: Android Release 清单结构

- **WHEN** Android 平台 Release 创建完成
- **THEN** 其 update.json 的 `assets` SHALL 仅含 `android` 字段，且 `version` 等于该平台 tag 的版本号，资产 `url` SHALL 为 OSS 镜像直链或回退的 GitHub Release 下载地址

#### Scenario: macOS Release 资产结构

- **WHEN** macOS 平台 Release 创建完成
- **THEN** 该 Release SHALL 同时挂载 DMG（首次安装用）与 zip（Sparkle 更新载荷），zip SHALL 由 `.app` 以保留扩展属性与签名元数据的方式打包

#### Scenario: 两端同时发布

- **WHEN** `platforms` 为 `both` 且构建成功
- **THEN** 流水线 SHALL 创建两个独立的 Release（tag 分别为 `android/vX.Y.Z` 与 `macos/vX.Y.Z`），各自只挂载本平台资产与清单

#### Scenario: 清单包含最低支持版本字段

- **WHEN** 平台 Release 创建完成
- **THEN** 其 update.json SHALL 包含 `minSupportedVersion` 字段，值等于发布时确定的最低支持版本；无可用值（未提供输入且无历史值可沿用）时该字段 SHALL 为空值或缺省

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

### Requirement: appcast 更新说明的渲染格式
发布流水线 SHALL 为 appcast 每个 item 的 `<description>` 显式声明 `sparkle:format="markdown"`，并 SHALL 以 Markdown 内容填充，使更新日志在 Sparkle 更新弹窗中按分类标题与列表条目分行呈现；格式属性 SHALL 使用带 sparkle 命名空间前缀的 `sparkle:format`，SHALL NOT 使用无前缀的 `type` 或其他属性名；更新说明 SHALL NOT 包含仅适用于 Release 页面的平台标注引用块与大标题，SHALL 只保留分类小标题与条目列表。

该约定 SHALL 覆盖 appcast 中全部历史 item：修复既有 item 时 SHALL 为其补齐 `sparkle:format` 属性并迁移说明内容格式，使尚未升级到最新版的客户端也能正确分行展示。

#### Scenario: 新 item 按 Markdown 声明格式
- **WHEN** 流水线为本次 macOS 发版生成新的 appcast item
- **THEN** 该 item 的 `<description>` SHALL 携带 `sparkle:format="markdown"` 属性，Sparkle SHALL 按 Markdown 渲染并将条目分行呈现，SHALL NOT 将换行折叠为单段文本

#### Scenario: 属性名缺失导致格式失效
- **WHEN** `<description>` 未携带 `sparkle:format` 属性，或改用 `type` 等无命名空间前缀的属性名
- **THEN** Sparkle SHALL 无法识别声明的格式并按 HTML 渲染纯文本，将换行折叠为空格、更新日志挤成单段，流水线与构建 SHALL NOT 因此报错

#### Scenario: 历史 item 补齐格式声明
- **WHEN** appcast 中存在未声明 `sparkle:format` 的历史 item
- **THEN** 维护 appcast 时 SHALL 为其补齐该属性并保证说明内容可被 Markdown 正确解析，SHALL NOT 仅对新增 item 生效

### Requirement: 发布说明范围与平台标注
发布流水线 SHALL 以"上一次同平台版本 tag 到本次"作为更新说明的 commit 范围，并在说明开头标注本次发布涉及的平台。

#### Scenario: 单端发布的说明范围
- **WHEN** 仅发布 Android，且 `android` 上一次 tag 为 `android/v1.2.4`
- **THEN** 更新说明 SHALL 只汇总 `android/v1.2.4` 到本次提交范围的变更，并标注本次仅涉及 Android

### Requirement: OSS 更新清单固定路径
发布流水线 SHALL 在生成各平台更新清单后，将其上传到 OSS 发布目录固定路径 `releases/<platform>/update.json`（公开读、覆盖式最新指针）；上传或匿名探测不通过时 SHALL 移除该平台 OSS 上的旧清单对象以触发客户端回退 GitHub，并照常完成发布，SHALL NOT 因该环节失败标记流水线失败。

#### Scenario: 上传最新指针成功
- **WHEN** 流水线生成某平台清单且 OSS 上传与匿名探测通过
- **THEN** `releases/<platform>/update.json` SHALL 为该平台本次发布清单（含该平台版本号与资产字段），匿名直链无需任何凭证即可下载

#### Scenario: 上传或探测失败清理旧指针
- **WHEN** 清单上传失败或上传后匿名探测未通过
- **THEN** 流水线 SHALL 移除该平台 OSS 上既有的 `update.json` 对象（避免客户端读取过期清单假报已是最新），记录回退日志并照常完成发布

#### Scenario: 镜像凭证缺失跳过上传
- **WHEN** 发布流水线未配置 OSS 发布镜像凭证
- **THEN** 流水线 SHALL 跳过清单上传且 SHALL NOT 报错中断，客户端侧按 OSS 清单不可用回退 GitHub

### Requirement: OSS appcast 固定路径
发布流水线 SHALL 在维护 macOS appcast 时将合并后的 `appcast.xml` 上传到 OSS 固定路径 `releases/macos/appcast.xml`（公开读）；上传或匿名探测不通过时 SHALL 移除 OSS 上的旧 appcast 以触发客户端回退 GitHub feed，并照常完成发布；GitHub `appcast` 分支的推送 SHALL 保持不变。

#### Scenario: 发版同步上传两份
- **WHEN** macOS 发布合并出新 appcast 内容
- **THEN** OSS `releases/macos/appcast.xml` SHALL 与该内容一致且匿名可下载，同时 GitHub `appcast` 分支 SHALL 收到相同内容

#### Scenario: 上传或探测失败清理旧对象
- **WHEN** appcast 上传失败或上传后匿名探测未通过
- **THEN** 流水线 SHALL 移除 OSS 上既有的 `appcast.xml` 对象（客户端探测失败回退 GitHub feed），记录回退日志并照常完成发布

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

### Requirement: 最低支持版本发布输入

发布流水线 SHALL 提供 `force_update`（本次升级强制）与 `min_supported_version`（显式最低支持版本，允许 `v` 前缀）输入，决定本次各平台清单的最低支持版本：`force_update` 为是时该平台 SHALL 取本次发布版本；提供 `min_supported_version` 时 SHALL 取该值；两者都未提供时 SHALL 沿用上一版同平台清单的 `minSupportedVersion`，无历史值则为空；两者同时提供且值不一致时流水线 SHALL 报错终止。两端 SHALL 按各自平台版本独立取值。

#### Scenario: 本次强制升级

- **WHEN** `force_update` 为是，Android 本次发布版本为 1.5.0
- **THEN** Android 清单的 `minSupportedVersion` SHALL 为 1.5.0

#### Scenario: 显式门槛

- **WHEN** `min_supported_version` 为 1.4.0，本次发布版本为 1.6.0
- **THEN** 本次清单的 `minSupportedVersion` SHALL 为 1.4.0，本次升级对 1.4.0 及以上用户为可选

#### Scenario: 沿用上一版并平台独立

- **WHEN** 两个输入都未提供，且上一版 Android 清单 `minSupportedVersion` 为 1.4.0、macOS 清单为空
- **THEN** 本次 Android 清单 SHALL 沿用 1.4.0，macOS 清单 SHALL 为空

#### Scenario: 输入冲突报错

- **WHEN** `force_update` 为是且 `min_supported_version` 指定了一个与本次发布版本不同的值
- **THEN** 流水线 SHALL 报错终止且不创建 Release

### Requirement: 最低支持版本校验

发布流水线 SHALL 在生成清单前校验确定后的最低支持版本为合法版本号（`X.Y.Z`，允许 `v` 前缀）且不高于本次平台发布版本；校验失败 SHALL 报错终止且不创建 Release。

#### Scenario: 门槛高于本次发布版本

- **WHEN** 确定的最低支持版本为 2.0.0，而本次平台发布版本为 1.6.0
- **THEN** 流水线 SHALL 报错终止且不创建 Release，避免用户升级后仍低于门槛

#### Scenario: 格式非法

- **WHEN** `min_supported_version` 输入不符合 `X.Y.Z` 格式（例如 `1.6`）
- **THEN** 流水线 SHALL 报错终止且不创建 Release
