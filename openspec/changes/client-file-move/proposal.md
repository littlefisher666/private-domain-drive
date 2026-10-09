## Why

客户端目前只能在当前目录内重命名单个对象，用户无法把文件或文件夹整理到其他目录；网盘使用越久，目录组织需求越强。OSS 标准 Bucket 不提供服务端原子 move（仅 HNS Bucket 支持 RenameObject，当前架构不适用），因此需要客户端以 copy + delete 组合实现，并对中断的半移动状态给出可靠的恢复语义。

## What Changes

- 新增文件/文件夹移动能力：单个条目（右键/更多菜单"移动到…"）与多选批量移动（批量操作栏"移动"按钮）
- 移动执行采用"逐对象 copy → 成功后立即 delete 源对象"的顺序，使操作幂等、可重入，中断最坏情况仅残留一个重复对象
- 文件夹移动递归展开全部子对象（含目录标记对象），逐对象搬运
- 移动开始前在 OSS 写入 manifest（源前缀、目标前缀、时间戳）；完成或撤销后删除 manifest
- 冷启动时检测残留 manifest，提示用户"继续移动"（直接重跑，幂等）或"撤销移动"（反向 copy + delete）
- 新增目录选择对话框（面包屑 + 目录列表导航），用于选定移动目标
- 移动前校验：目标路径重名冲突（阻止或要求改名）、禁止将文件夹移动到自身或其子目录内
- 移动进行中在 UI 层展示进行中状态，列表在移动完成后统一刷新

## Capabilities

### New Capabilities

- `file-move`: 定义文件/文件夹移动的执行语义（逐对象 copy+delete、幂等可重入）、manifest 断点续传与撤销、冲突与自包含校验、目标目录选择交互。

### Modified Capabilities

- `workspace-item-actions`: 右键/更多菜单的动作集合从"预览或打开、下载、重命名和删除"扩展为增加"移动到…"单条目操作。
- `batch-file-operations`: 批量选择状态下的业务动作从"仅包含下载和删除"扩展为增加"移动"动作（移除原"不展示移动"的限制）。

## Impact

- 代码：`client/` 子仓库内 `lib/shared/state/app_controller.dart`（新增 move 状态与方法）、`lib/features/workspace/infrastructure/oss_client.dart`（如需补充接口）、workspace 页面与目录选择对话框（新 widget）、右键菜单与批量操作栏入口
- 不涉及服务端（FC）改动，不涉及接口契约变化（纯客户端直连 OSS 组合操作）
- 依赖现有能力：`OssClient.copy/delete/deleteMany/listAllObjectKeys/objectExists`、多选状态机、`_moveToRecycleBin` 的 manifest 模式
- 文档：归档后按约定同步 `openspec/specs/` 主规格；如 `docs/Flutter架构设计.md` 的模块职责有新增 widget 层级说明，需一并核对
