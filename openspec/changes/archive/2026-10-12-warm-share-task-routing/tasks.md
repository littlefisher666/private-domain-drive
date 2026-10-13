# Tasks

## 1. Manifest 调整

- [x] 1.1 修改 `client/android/app/src/main/AndroidManifest.xml`：移除 MainActivity 的 `android:taskAffinity=""`，`launchMode` 由 `singleTop` 改为 `singleTask`；验证方式：`grep -n "taskAffinity\|launchMode" client/android/app/src/main/AndroidManifest.xml` 输出仅含 `android:launchMode="singleTask"` 且无 taskAffinity 行

## 2. 真机行为验证（对照 specs/share-import/spec.md 新增场景）

- [x] 2.1 验证"应用在前台时分享进入既有实例"：`flutter run -d android --dart-define-from-file=../secrets/client/local.json` 启动并登录，停留在文件空间页面，从系统相册分享图片进应用；验证当前页面状态保持、直接弹出目录选择弹窗、无启动页与重新登录
- [x] 2.2 验证"应用在后台时分享进入既有实例"：应用在后台（如停留在二级目录页面）时从相册分享进入；验证恢复到离开前页面、弹窗正常弹出、当前目录等内存状态不丢失
- [x] 2.3 验证"分享进入不产生重复任务卡片"：分享进入后打开系统最近任务视图，确认应用仅一张卡片
- [x] 2.4 验证"冷启动分享行为不变"：彻底退出应用后从相册分享进入，确认登录就绪后弹出目录选择弹窗，导入流程与既有口径一致

## 3. 提交

- [ ] 3.1 在 `client/` 子仓库提交 Manifest 变更；验证方式：`git -C client status` 工作区干净且提交信息包含本次调整说明

## Workflow follow-up

- 真机验证全部通过后，归档本 change（`openspec archive`），delta 同步至 `openspec/specs/share-import/spec.md`
- 归档后在主仓库提交 openspec 变更
