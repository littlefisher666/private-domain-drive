# Design

## Context

`client/android/app/src/main/AndroidManifest.xml` 的 MainActivity 沿用 Flutter `flutter create` 模板默认声明：`android:launchMode="singleTop"` 且 `android:taskAffinity=""`。分享入口（`ACTION_SEND` / `ACTION_SEND_MULTIPLE`）加入后，相册分享面板以 `FLAG_ACTIVITY_NEW_TASK` 启动目标 Activity；空 taskAffinity 使系统无法把该 Intent 关联到应用既有任务栈，只能新建任务栈与 Activity 实例，进而创建第二个 Flutter 引擎。`MainActivity.kt` 中 `onNewIntent` 分享接收链路与 Dart 侧消费逻辑均已就绪，问题只在 Manifest 声明。

## Goals / Non-Goals

**Goals:**

- 热启动分享路由到既有应用实例，走既有 `onNewIntent` → EventChannel 实时推送路径
- 防止 Flutter 模板默认值（`taskAffinity=""`）在后续工程演化中回流

**Non-Goals:**

- 不改动冷启动分享路径（`configureFlutterEngine` 内接收 Intent）
- 不改动 Dart 侧分享导入消费逻辑与防重入逻辑
- 不涉及 macOS 端

## Decisions

**1. 移除 `android:taskAffinity=""`，恢复包名默认亲和性**

- 备选：保留空亲和性并依赖 `singleTask`。空亲和性 + `singleTask` 会导致 Activity 独占一个与包名无关的任务栈，分享进入与桌面图标进入仍可能落在不同任务栈，行为依旧分裂，故不采用。
- 备选：改用 `android:documentLaunchMode` 或动态 Intent flags。过度设计，一期无此需求。
- 恢复默认亲和性后，`FLAG_ACTIVITY_NEW_TASK` 分享 Intent 能匹配到既有任务栈，把目标 Activity 定位到栈顶。

**2. `launchMode` 由 `singleTop` 调整为 `singleTask`**

- `singleTop` 只能拦截同栈栈顶重复创建；当 Activity 不在栈顶（如应用在后台停留在二级页面）时，`ACTION_SEND` 会在既有栈上再压一个 MainActivity 实例，Flutter 引擎与 Activity 生命周期错配。
- `singleTask` 保证任意入口（分享/桌面图标）下 MainActivity 全局单实例，未在栈顶时先清栈回根再回调 `onNewIntent`。本应用为单 Activity Flutter 架构，根 Activity 即全应用，不存在误清业务栈的风险。
- 备选：保持 `singleTop` 并在分享 Intent 上做 `FLAG_ACTIVITY_CLEAR_TOP` 处理——分享 Intent 由系统相册构造，应用侧无法控制其 flags，不可行。

**3. 既有 Kotlin/Dart 链路零改动**

`MainActivity.onNewIntent` 已实现 `receiveShareIntent` 复用（MainActivity.kt:164-168），热启动分享进入既有实例后自动走该路径，无需新增代码。

## Risks / Trade-offs

- [Flutter 工程重建或模板升级可能带回 `taskAffinity=""`] → 已在本 change 的规格中固化"热启动分享进入既有实例"的验收场景，回归时可被场景测试发现。
- [`singleTask` 清栈行为：应用在后台处于二级页面时分享进入，会回到根页面再弹分享弹窗] → 单 Activity Flutter 架构下页面栈由 Flutter 路由管理，Activity 清栈不影响 Flutter 路由状态；实测确认即可。
