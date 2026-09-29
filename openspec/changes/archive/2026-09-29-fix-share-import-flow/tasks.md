## 1. 客户端实现

- [x] 1.1 在 `client/lib/features/share_import/presentation/share_target_dialog.dart` 标题栏新增「新建文件夹」入口，复用 `AppFeedback.promptText` 与 `AppController.createFolder(name, targetPath: _currentPath)`，成功后刷新弹窗目录列表
- [x] 1.2 在 `client/lib/app/app.dart` 取消分享弹窗分支清除 `_openedShareSignature`，修复取消后重新分享同一批内容不再弹出目录选择的缺陷
- [x] 1.3 在 `client/lib/features/auth/presentation/splash_page.dart` 与 `login_page.dart` 的 `pushReplacementNamed` 前增加「自身回到栈顶」等待，消除误删上层分享弹窗的路由竞态

## 2. 文档同步

- [x] 2.1 更新 `docs/功能需求.md` 2.8 节需求说明（弹窗内新建文件夹、取消后重新分享可再次弹出）与 3.5 节上传流程

## 3. 验证

- [x] 3.1 `flutter analyze` 通过（无新增告警）
- [x] 3.2 真机验证：分享弹窗内新建文件夹后「上传到此处」上传成功
- [x] 3.3 真机验证：取消弹窗后重新分享同一批内容，目录选择弹窗再次弹出
- [x] 3.4 真机验证：冷启动分享进入，目录选择弹窗稳定显示，不再被启动页跳转顶掉
