# Proposal

## Why

Android 端 `MainActivity` 沿用了 Flutter 模板默认的 `android:taskAffinity=""` 与 `launchMode="singleTop"`。当应用已在前台/后台运行时，从系统相册分享进入会因空亲和性匹配不到既有任务栈，导致系统新建任务栈、新建 MainActivity 实例并启动全新的 Flutter 引擎——用户看到的是"另一个 app"（重新走启动页/登录流程、内存状态全空、最近任务出现两张卡片），与既有的"热启动分享直接弹出目录选择"的体验预期相悖。

## What Changes

- Android 端热启动分享 SHALL 路由到已存在的应用实例（单一任务栈、单一 Flutter 引擎），通过 `onNewIntent` 接收分享内容，不得新建 Activity 实例或任务栈
- 具体实现：移除 `MainActivity` 的 `android:taskAffinity=""`（恢复包名默认亲和性），`launchMode` 由 `singleTop` 调整为 `singleTask`
- 冷启动分享路径（`configureFlutterEngine` 内接收 Intent）行为不变

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `share-import`: 「接收系统分享并弹出目录选择」需求补充热启动任务栈路由口径：热启动分享必须进入已存在的应用实例并在其上弹出目录选择弹窗，最近任务不得出现重复的应用卡片；现有场景（相册分享进入、未登录进入、同一批次不重复弹窗、取消后再分享）验收口径不变，仅新增热启动实例路由的验收场景。

## Impact

- `client/android/app/src/main/AndroidManifest.xml`：MainActivity 声明调整（已完成）
- `client/android/.../MainActivity.kt`：无需改动，`onNewIntent` 分享接收链路已存在
- Dart 侧分享导入消费逻辑：无需改动，热启动走既有 EventChannel 实时推送路径
- macOS 端：无影响
