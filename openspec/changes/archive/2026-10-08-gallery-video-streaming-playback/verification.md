# 手动验证：presignGetObjectUrl（双端）

目的：验证各端 `presignGetObjectUrl` 生成的预签名 URL 可用于 GetObject 流式拉取（HTTP Range），且到期后失效。URL 等同于访问凭证，验证后即弃，不得写入任何文件或日志（本文件仅记录操作步骤，不记录 URL）。

## 前置条件

- 双端 app 已登录并完成 OSS 会话配置（`configure` 成功）。
- 准备一个测试对象 key（任意已存在的对象，建议用一个视频文件以便模拟拉流）。

## macOS（Swift SDK `Client.presign`）

1. 在调试会话中调用 `presignGetObjectUrl(key, expires: Duration(minutes: 2))`，将返回的 URL 复制到终端环境变量（命令行即弃，不留 history 之外的副本）：
   ```sh
   export URL='https://<bucket>.<endpoint>/<key>?...'   # 短有效期验证用
   ```
2. 验证可拉流（Range 请求）：
   ```sh
   curl -s -D - -o /dev/null -H 'Range: bytes=0-1023' "$URL" | head -8
   ```
   预期：`HTTP/1.1 206 Partial Content`、`Content-Range: bytes 0-1023/<总大小>`。
3. 验证 Range 起始偏移：
   ```sh
   curl -s -D - -o /dev/null -H 'Range: bytes=1000-1999' "$URL" -r - | head -4
   ```
   预期：206，`Content-Range: bytes 1000-1999/<总大小>`。
4. 验证过期失效：等待有效期（如 2 分钟）过后重复步骤 2。
   预期：`HTTP/1.1 403 Forbidden`（ossCode `AccessDenied` / 签名过期）。

## Android（oss-android-sdk `presignConstrainedURL`）

步骤同上。获取 URL 的调试方式（任选其一）：

- 在 `PrivateDomainOssPlugin.kt` 的 `presignGetObjectUrl` 打断点/临时 debug 输出后由 app 触发；
- 或使用集成测试（`integration_test/`）在真机上调用通道方法并打印。

curl 验证命令与预期结果与 macOS 完全一致（206 / Content-Range / 过期 403）。

## 记录

| 平台 | 206 Range 拉流 | 过期失效 | 执行人 | 日期 |
| ---- | -------------- | -------- | ------ | ---- |
| macOS | ☐ | ☐ | | |
| Android | ☐ | ☐ | | |
