# 提案：分享导入上传闭环修复与弹窗内新建文件夹

## Why

Android 系统分享导入流程存在两处闭环断裂：用户在目录选择弹窗中无法直接新建文件夹，取消弹窗去主界面建完后再重新分享同一批内容时，防重入签名会拦截目录选择弹窗不再弹出；此外冷启动分享时启动页的 `pushReplacementNamed` 会误删已压在其上层的目录选择弹窗，弹窗闪现后直接进入首页，导入流程中断。

## What Changes

- 分享导入目录选择弹窗（`ShareTargetDialog`）标题栏新增「新建文件夹」入口：在当前目录创建文件夹后刷新列表，全程不关闭弹窗，可直接「上传到此处」完成上传
- 修复防重入缺陷：用户取消分享弹窗时清除 `_openedShareSignature`，之后重新分享同一批内容仍能再次弹出目录选择
- 修复启动页/登录页路由竞态：`pushReplacementNamed` 替换的是最上层路由，会误删压在上层的分享弹窗；启动页与登录页跳转前等待自身回到栈顶再跳转
- 已在 client 子仓库实现，`docs/功能需求.md` 已同步 2.8 节需求说明与 3.5 节上传流程

## Capabilities

### New Capabilities

- `share-import`: Android 系统分享接收入口、目录选择弹窗交互（含弹窗内新建文件夹）、取消后重新分享、与启动/登录路由跳转的时序约束

### Modified Capabilities

（无 —— 现有主规格中没有覆盖分享导入能力）

## Impact

- 客户端：
  - `client/lib/features/share_import/presentation/share_target_dialog.dart`（新增新建文件夹入口与 `_createFolder`）
  - `client/lib/app/app.dart`（取消弹窗时清除防重入签名）
  - `client/lib/features/auth/presentation/splash_page.dart`、`client/lib/features/auth/presentation/login_page.dart`（跳转前等待自身回到栈顶）
- 文档：`docs/功能需求.md` 2.8 / 3.5 节
- 不涉及服务端与接口契约；`createFolder` 复用既有 `AppController.createFolder` 能力
