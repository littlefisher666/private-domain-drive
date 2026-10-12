# Tasks

## 1. 领域模型与枚举扩展

- [x] 1.1 在 `client/lib/features/transfer/domain/transfer_task.dart` 新增 `TransferTaskStatus.interrupted` 与可选字段 `targetDir`（含 copyWith/toJson/fromJson），并确认 `flutter analyze` 在现有 switch 穷举处提示缺分支，逐处补齐 interrupted 处理，验证：`flutter analyze` 通过
- [x] 1.2 为 interrupted 状态补充传输中心状态徽章文案「已中断」与对应颜色（移动端与桌面布局口径一致），验证：传输中心页面中构造 interrupted 任务展示正确

## 2. staging 文件迁移

- [x] 2.1 在 `client/` 新增 staging 迁移工具：判定源路径是否位于应用缓存目录，命中则 move 到 `getApplicationSupportDirectory()/upload-staging/<taskId>-<fileName>` 并返回新路径，否则原样返回；验证：单元测试覆盖缓存内迁移、持久路径不迁移两个分支
- [x] 2.2 在 `uploadFile()` 入口与 `confirmShareUpload()` 接入迁移（分享链路在入队前批量迁移并清理 `cacheDir/shared-import` 中的原拷贝），验证：`flutter analyze` 通过，手动分享一张图片后上传成功且 `upload-staging/` 出现对应文件
- [x] 2.3 接入 staging 清理：任务成功、被放弃、失败后被移除时按「sourcePath 位于 staging 目录内」删除对应文件，验证：单元测试覆盖三种清理时机

## 3. 未完成上传任务持久化

- [x] 3.1 在 `AppController` 新增 `upload_pending:v1` 持久化：入队时写入 `TransferTask.toJson()`（仅上传、非终态、含 targetDir），状态迁移（pending/running/failed/success/canceled）时整表重写，进度回调不触发写入；验证：单元测试模拟入队→成功后 key 中记录清空、入队→失败后记录保留
- [x] 3.2 保证取消与放弃路径同样回写持久化 key，验证：单元测试覆盖取消后记录移除

## 4. 冷启动恢复

- [x] 4.1 在 bootstrap 恢复点读取 `upload_pending:v1`：反序列化 → 校验 sourcePath 存在 → 转 interrupted 入列，缺失转 failed（message「源文件已丢失」）并入终态历史，最后回写清理后的持久化记录，验证：单元测试覆盖文件存在/缺失两个分支
- [x] 4.2 在传输中心为 interrupted 任务提供「继续上传」（复用现有重试路径重新入队，进度归零）与「放弃」（转 canceled 并清理 staging）操作，及「全部继续 / 全部放弃」批量入口，验证：单元测试覆盖单任务继续与放弃，批量入口逐个调用单任务操作

## 5. 集成验证与文档

- [x] 5.1 Android 真机集成验证：相册分享 10+ 张图片上传，中途从最近任务划掉应用，重新打开后在传输中心看到全部任务为已中断，继续上传可完成、放弃可清理；验证：按上述步骤操作并观察传输中心与 staging 目录
- [ ] 5.2 macOS 冒烟验证：app 内选择本地磁盘文件上传后退出重开，确认持久路径任务同样可恢复且未产生 staging 副本，验证：手动操作确认
- [x] 5.3 更新主仓库 `docs/Flutter架构设计.md` 传输模块描述（未完成任务持久化、staging 目录、interrupted 状态），验证：文档内容与实现一致
- [x] 5.4 `client/` 子仓库提交本次改动，主仓库更新 submodule 指针，验证：`git status` 干净

## Workflow follow-up

- 归档前确认 specs 增量与实现一致，走 `openspec archive` 归档并同步 `openspec/specs/`。
