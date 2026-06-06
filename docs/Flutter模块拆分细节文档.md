# 私域网盘 Flutter 模块拆分细节文档

## 1. 文档说明

- 项目名称：私域网盘
- 文档类型：Flutter 模块拆分细节文档
- 关联文档：
  - [PRD.md](/Users/littlefisher/Documents/LittleFisher/Workspaces/jyn/private-domain-drive/docs/PRD.md)
  - [技术文档.md](/Users/littlefisher/Documents/LittleFisher/Workspaces/jyn/private-domain-drive/docs/技术文档.md)
  - [接口文档.md](/Users/littlefisher/Documents/LittleFisher/Workspaces/jyn/private-domain-drive/docs/接口文档.md)
- 文档目标：明确 Flutter 工程的一期目录结构、模块职责、依赖边界和状态流转，便于后续直接拆分开发任务。

## 2. 拆分目标

- Android 与 macOS 共用大部分业务代码
- 平台差异收敛在基础设施层
- 认证、文件浏览、上传下载、预览、权限显示相互解耦
- 避免为一期引入过重架构
- 让后续新增功能时尽量局部扩展，不改动全局结构

## 3. 分层设计

建议采用四层结构：

- `presentation`：页面、组件、交互状态
- `application`：用例编排与状态协调
- `domain`：核心模型、能力定义、仓储抽象
- `infrastructure`：接口调用、OSS 访问、平台能力适配

### 3.1 分层职责

#### presentation

- 展示列表、详情、预览、上传下载进度
- 响应用户点击、拖拽、选择文件等交互
- 只依赖 application 层暴露的状态和命令

#### application

- 编排登录初始化、目录切换、上传下载任务创建
- 聚合多个 domain service 或 repository
- 对 presentation 输出可直接消费的 view state

#### domain

- 定义 `FileItem`、`UserSession`、`Capabilities`、`TransferTask` 等模型
- 定义 repository interface
- 定义纯业务规则，如“是否允许删除”“是否需要分片上传”

#### infrastructure

- 实现 FC API client
- 实现 OSS client 封装
- 实现文件选择器、拖拽、下载保存、本地缓存等平台能力

## 4. 推荐目录结构

```text
lib/
  app/
    app.dart
    router/
    theme/
    bootstrap/
  core/
    constants/
    errors/
    utils/
    logging/
    network/
  features/
    auth/
      presentation/
      application/
      domain/
      infrastructure/
    workspace/
      presentation/
      application/
      domain/
      infrastructure/
    transfer/
      presentation/
      application/
      domain/
      infrastructure/
    preview/
      presentation/
      application/
      domain/
      infrastructure/
    settings/
      presentation/
      application/
      domain/
      infrastructure/
  shared/
    widgets/
    models/
    providers/
```

## 5. 模块拆分建议

### 5.1 `app` 模块

职责：

- 应用启动
- 路由注册
- 全局主题
- 全局依赖装配
- 启动时的初始化流程

建议子结构：

```text
app/
  app.dart
  bootstrap/
    app_bootstrap.dart
    app_initializer.dart
  router/
    app_router.dart
    route_names.dart
  theme/
    app_theme.dart
```

### 5.2 `core` 模块

职责：

- 放置跨业务复用的基础设施
- 不承载具体业务语义

建议内容：

- 网络请求封装
- 错误类型定义
- 时间、文件大小格式化工具
- 日志封装
- 全局常量

注意：

- `core` 不应反向依赖任何 feature 模块

### 5.3 `features/auth`

职责：

- 登录态管理
- 会话初始化
- STS 凭证刷新
- 用户能力同步

建议 domain 模型：

- `UserIdentity`
- `UserSession`
- `StsCredentials`
- `Capabilities`
- `AppConstraints`

建议 application 用例：

- `BootstrapSessionUseCase`
- `RefreshSessionUseCase`
- `LogoutUseCase`

建议 infrastructure 组件：

- `SessionApiClient`
- `SessionRepositoryImpl`
- `CredentialsMemoryStore`

presentation 关注点：

- 启动页
- 登录中状态
- 会话失效后的跳转与提示

### 5.4 `features/workspace`

职责：

- 文件列表浏览
- 目录切换
- 刷新
- 文件操作入口汇总

建议 domain 模型：

- `FileItem`
- `DirectoryNode`
- `WorkspacePath`

建议 application 用例：

- `LoadDirectoryUseCase`
- `RefreshDirectoryUseCase`
- `EnterDirectoryUseCase`
- `BuildWorkspaceActionsUseCase`

建议 infrastructure 组件：

- `OssFileRepository`
- `FileTypeResolver`
- `WorkspaceMapper`

presentation 关注点：

- 文件列表页
- 空态、错误态
- 移动端单栏与桌面端双栏布局

### 5.5 `features/transfer`

职责：

- 上传任务管理
- 下载任务管理
- 进度同步
- 失败重试

建议 domain 模型：

- `TransferTask`
- `TransferTaskStatus`
- `UploadRequest`
- `DownloadRequest`

建议 application 用例：

- `CreateUploadTaskUseCase`
- `CreateDownloadTaskUseCase`
- `RetryTransferTaskUseCase`
- `CancelTransferTaskUseCase`

建议 infrastructure 组件：

- `OssUploadDataSource`
- `OssDownloadDataSource`
- `MultipartUploadCoordinator`
- `LocalFileSaver`

presentation 关注点：

- 上传下载任务面板
- 单任务进度条
- 失败态与重试入口

### 5.6 `features/preview`

职责：

- 根据文件类型选择预览策略
- 图片、PDF、文本预览

建议 domain 模型：

- `PreviewableFile`
- `PreviewType`

建议 application 用例：

- `ResolvePreviewTypeUseCase`
- `PreparePreviewUseCase`

建议 infrastructure 组件：

- `ImagePreviewLoader`
- `PdfPreviewLoader`
- `TextPreviewLoader`

presentation 关注点：

- 图片预览页
- PDF 预览页
- 文本预览页
- 不支持类型提示页

### 5.7 `features/settings`

一期可保持极简，职责：

- 展示当前登录用户
- 查看当前 bucket / rootPrefix 等只读信息
- 手动触发会话刷新或退出登录

## 6. 关键共享模型

### 6.1 会话模型

```dart
class UserSession {
  final UserIdentity user;
  final StsCredentials credentials;
  final OssConfig ossConfig;
  final Capabilities capabilities;
  final AppConstraints constraints;
}
```

### 6.2 文件模型

```dart
class FileItem {
  final String path;
  final String name;
  final bool isDirectory;
  final int? size;
  final DateTime updatedAt;
  final String? mimeType;
}
```

### 6.3 任务模型

```dart
enum TransferTaskStatus {
  pending,
  running,
  success,
  failed,
  canceled,
}
```

## 7. 状态管理建议

一期建议选择一个轻量且团队熟悉的方案，例如：

- `Riverpod`
- `Bloc`

若没有既有偏好，更建议：

- 页面级状态用 `Notifier` / `StateNotifier`
- 全局会话状态单独维护
- 上传下载任务采用独立任务仓库 + 可观察状态流

### 7.1 推荐状态切分

- `sessionState`：登录态、凭证、能力、配置
- `workspaceState`：当前目录、列表数据、加载状态
- `transferState`：任务列表、任务进度、失败状态
- `previewState`：预览加载状态、预览数据

### 7.2 状态管理原则

- 页面不要直接拼接复杂业务逻辑
- 会话状态变更要能够联动列表刷新和任务失效处理
- 上传下载状态不要分散在多个页面局部 state 中

## 8. 依赖关系约束

建议遵守以下方向：

```text
presentation -> application -> domain
presentation -> shared
application -> domain
infrastructure -> domain
app -> core + features + shared
```

限制：

- feature 之间不要直接互相调用 infrastructure 实现
- `workspace` 不直接依赖 `preview` 页面实现，只传递文件对象
- `transfer` 不直接操作页面组件，只发布任务状态

## 9. 启动流程拆分

### 9.1 App 启动流程

1. `main()` 启动 Flutter 应用。
2. `app_bootstrap` 初始化日志、配置、依赖注入。
3. 进入启动页 `SplashPage`。
4. `BootstrapSessionUseCase` 检查登录态并请求会话初始化。
5. 初始化成功后进入文件列表首页。
6. 初始化失败时进入登录页或错误页。

### 9.2 会话刷新流程

1. 业务层发现凭证即将过期或 OSS 返回凭证失效。
2. 触发 `RefreshSessionUseCase`。
3. 更新 `sessionState` 中的凭证。
4. 依赖该凭证的仓储实例使用最新凭证继续工作。

## 10. 页面拆分建议

### 10.1 移动端

- `SplashPage`
- `LoginPage`
- `WorkspacePage`
- `PreviewPage`
- `TransferTasksPage`
- `SettingsPage`

### 10.2 macOS

- `SplashPage`
- `LoginPage`
- `WorkspaceShellPage`
- `DirectoryListPane`
- `FileListPane`
- `PreviewPane` 或独立预览窗口
- `TransferDrawer` 或底部任务栏

## 11. 平台适配拆分

### 11.1 建议抽象的平台能力接口

- `FilePickerService`
- `DragDropService`
- `DownloadDirectoryService`
- `LocalCacheService`

### 11.2 Android 差异点

- 文件选择器依赖系统能力
- 前后台切换要处理任务可见状态
- 预览优先保证流畅与权限兼容

### 11.3 macOS 差异点

- 支持拖拽上传
- 支持更高效的目录浏览布局
- 支持系统风格的保存路径选择

## 12. 错误处理拆分

建议统一错误基类：

- `AppError`
- `NetworkError`
- `AuthError`
- `PermissionError`
- `TransferError`
- `PreviewError`

处理原则：

- infrastructure 层负责把 SDK 异常转换为业务可识别错误
- application 层决定是否重试、是否提示重新登录
- presentation 层负责最终展示文案

## 13. 一期开发任务映射

### 13.1 第一步

- 完成 `auth` 模块
- 完成 `workspace` 基础浏览
- 打通会话初始化到文件列表展示

### 13.2 第二步

- 完成 `transfer` 上传下载
- 接入分片上传
- 增加任务状态展示

### 13.3 第三步

- 完成 `preview` 图片/PDF/文本预览
- 增加 macOS 拖拽上传
- 收敛权限展示与错误体验

## 14. 推荐落地顺序

1. 先搭目录结构和会话链路，不先做复杂 UI。
2. 再打通 OSS 文件列表能力。
3. 然后补上传下载与任务管理。
4. 最后做预览、桌面适配和体验优化。

## 15. 结论

Flutter 端一期应围绕 `auth`、`workspace`、`transfer`、`preview` 四个核心 feature 拆分，配合 `app`、`core`、`shared` 三类公共层完成工程组织。这样既能满足 Android 与 macOS 的复用需求，也能把平台差异控制在可维护范围内。
