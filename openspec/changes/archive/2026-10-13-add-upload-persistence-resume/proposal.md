# Proposal

## Why

Android 端目前上传任务的待上传清单、队列与进行中状态全部保存在内存中，只有已完成/已取消的历史记录会持久化（`transfer_history:v1`）。用户从系统相册分享大量照片上传时，如果应用中途被退出或被系统回收，整个清单与队列都会丢失，只能重新分享并重新选择全部照片，几百张照片场景下效率极低。

## What Changes

- 新增上传任务持久化：入队后的上传任务（排队、进行中、失败）连同本地源文件路径、目标目录、对象键、批次信息写入本地持久化存储，应用被杀后可恢复。
- 分享导入与相册选择产生的待上传文件落盘到持久目录（staging）：应用退出后源文件不依赖 `cacheDir`，上传完成后清理。
- 应用冷启动恢复：未完成任务恢复为「已中断」状态，在传输中心展示，用户可选择「继续上传」或「放弃」，放弃时清理对应 staging 文件。
- 恢复时校验本地源文件存在性：文件缺失的任务标记为失败并给出提示文案。
- 不含前台服务/后台保活（二期另行提案），应用被杀后不自动续传，仅在下次打开时提供恢复入口。

## Capabilities

### New Capabilities

- `upload-persistence`: 上传任务与分享导入待上传清单的持久化、源文件 staging、冷启动恢复与继续上传决策。覆盖：哪些状态要持久化、staging 文件生命周期、恢复时的文件存在性校验、中断任务的恢复交互。

### Modified Capabilities

- `transfer-queue-management`: 传输中心新增「已中断」任务状态的展示与「继续上传 / 放弃」操作要求；任务状态优先级排序需纳入已中断状态。

## Impact

- `client/lib/shared/state/app_controller.dart`：`AppController` 的队列管理、持久化逻辑（现有 `_persistTransferHistory` 仅保留终态记录，需扩展为包含未完成任务的持久化存储）。
- `client/lib/features/transfer/`：`TransferTask` 序列化扩展（持久化字段、中断状态）、传输中心 UI（中断状态展示、继续/放弃操作）。
- `client/lib/features/share_import/`：分享导入与相册选择的源文件 staging 逻辑。
- `client/android/.../MainActivity.kt`：现有 `cacheDir/shared-import/` 拷贝逻辑保持不变，staging 迁移在 Dart 侧完成，原生端预期少量或无改动。
- 持久化介质沿用 SharedPreferences（与现有 `transfer_history:v1` 同层），不引入数据库。
- 服务端无改动；文档需同步 `docs/Flutter架构设计.md` 中传输模块相关描述。
