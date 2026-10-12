# Tasks

## 1. 原生端后台化与事件协议（client/android）

- [x] 1.1 在 `MainActivity.kt` 引入单线程 Executor：`receiveShareIntent()` 仅在主线程解析 URI 列表，复制提交到后台串行执行；缓冲（原 `pendingItems`）读写收敛到主线程（后台任务结果 post 回主线程处理），验证：`flutter build apk --debug` 编译通过，分享单张图片上传成功
- [x] 1.2 实现信封事件协议（batch_start / item / batch_done，含 UUID batchId 与成功/失败计数），单个文件复制失败跳过并计入失败数，验证：Dart 侧临时打印事件日志，分享多张图片观察到完整事件序列
- [x] 1.3 处理冷启动竞态：eventSink 未监听时缓冲事件，`onListen` 按序冲刷后转实时推送；`takePendingItems()` 改为返回缓冲中已完整的批次（信封格式）并在取走后移除，验证：冷启动分享进入应用，待上传内容不丢失、不重复；热启动分享事件实时到达

## 2. Dart 桥接与控制器

- [x] 2.1 升级 `android_share_import_bridge.dart`：解析信封事件为类型化对象（批次开始/单项/批次完成），未知类型忽略并打日志；`takePendingItems` 返回完整批次列表，验证：单元测试覆盖三类事件解析与未知类型忽略
- [x] 2.2 在 `AppController` 新增批次渐进接收：`beginShareImportBatch` / `addShareImportItem` / `finishShareImportBatch`，维护批次进度状态，批次完成后并入 `pendingShareItems`；批次内全部失败时不进入待上传清单，验证：单元测试覆盖渐进到达、批次完成并入、全失败批次
- [x] 2.3 调整 `app.dart`：防重入签名从项 id 拼接串改为批次 id，取消弹窗时清除当前批次签名；冷启动路径将 `takePendingItems` 的完整批次转为立即完成的批次，验证：单元测试覆盖同批次去重与取消后重新接收

## 3. 目录选择弹窗进度

- [x] 3.1 在 `share_target_dialog.dart` 增加导入进度行：批次未完成显示「正在导入 x/n」并禁用确认按钮；批次完成后启用，`failed > 0` 时提示失败数量，验证：手动分享大批量文件观察进度行与按钮状态变化
- [x] 3.2 确认路径回归：确认上传仍以批次完成后的完整 `pendingShareItems` 入队，`confirmShareUpload()` 行为不变，验证：分享多张图片完成目录选择后全部上传成功

## 4. 集成验证与文档

- [ ] 4.1 Android 真机验证：相册分享 100+ 张图片，复制期间应用可正常操作、弹窗进度实时更新；复制中途从最近任务划掉应用重新打开无异常；登录未就绪时分享进入，登录后弹窗内容完整；验证：按上述步骤手动操作
- [x] 4.2 `flutter analyze` 与现有测试全量通过，验证：CI/本地执行无新增告警
- [x] 4.3 更新主仓库 `docs/Flutter架构设计.md` 分享导入链路描述（后台复制、信封事件协议、批次防重入），验证：文档内容与实现一致
- [ ] 4.4 `client/` 子仓库提交本次改动，主仓库更新 submodule 指针，验证：`git status` 干净

## Workflow follow-up

- 归档前确认 specs 增量与实现一致，走 `openspec archive` 归档并同步 `openspec/specs/`。
- 若 `add-upload-persistence-resume` 先归档，实施时按其 staging 迁移后的代码形态适配 `confirmShareUpload()` 附近逻辑。
