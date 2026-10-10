## 1. 基础设施与数据模型（client 子仓库）

- [x] 1.1 在 `lib/features/workspace/domain/` 新增移动任务模型 `MoveTaskEntry`（id、sourcePrefixes、targetPrefix、createdAt、编码/解码 JSON），风格对齐 `RecycleBinEntry`
- [x] 1.2 核对 `OssClient` 既有接口（copy/delete/deleteMany/listAllObjectKeys/objectExists/uploadText/listPrefixes）是否满足移动需求，缺口在 `oss_client.dart` 补齐（含原生插件层 `packages/private_domain_oss` 的 Swift/Kotlin 透传，如需要）
- [x] 1.3 确认 `shared/.moves/` 前缀被工作区列表、gallery、回收站等递归扫描排除（参照 `.trash/` 的隐藏处理，核对 `workspace-hidden-entries` 约定）

## 2. AppController 移动核心逻辑

- [x] 2.1 在 `AppController` 新增移动状态（isMoving、进度、互斥保护）与公开方法 `moveItems(List<FileItem>, String targetDir)`
- [x] 2.2 实现前置校验：源去重（父文件夹覆盖子项）、目标合法性（目标不得为源自身或其子目录）、`objectExists` 逐条目冲突检测，产出校验结果供 UI 弹冲突对话框
- [x] 2.3 实现移动执行核心：写 manifest（`shared/.moves/<id>/manifest.json`）→ 文件夹经 `listAllObjectKeys` 展开全部子 key（含目录标记）→ 逐对象 copy 成功后立即 delete 源 → 完成后删 manifest，参照 `_moveToRecycleBin` 的会话与错误处理模式
- [x] 2.4 实现冲突处理策略：跳过 / 保留两者（自动生成不冲突名称，如 `名称 (2)`）/ 取消，默认不覆盖
- [x] 2.5 移动结束后刷新受影响目录列表、目录大小缓存与 treeRevision，清理选择状态并通知 gallery hooks（对齐批量删除后的刷新逻辑）
- [x] 2.6 实现部分失败汇总：报告成功与失败数量及失败对象列表，已成功对象保持新位置

## 3. 断点恢复与撤销

- [x] 3.1 实现 `listPendingMoves()`：会话恢复后 list `shared/.moves/` 前缀并下载解析全部残留 manifest
- [x] 3.2 实现「继续移动」：对 manifest 的 sourcePrefixes 幂等重跑移动执行核心，完成后删 manifest
- [x] 3.3 实现「撤销移动」：将 targetPrefix 下对象反向搬回 sourcePrefixes 对应位置（冲突时用不冲突名称），完成后删 manifest
- [x] 3.4 在会话恢复流程（冷启动）接入残留任务检测，弹出恢复提示（逐个任务展示源/目标/时间 + 继续与撤销按钮）

## 4. UI 入口与目录选择对话框

- [x] 4.1 新建目录选择对话框 widget：面包屑导航 + 目录列表（仅文件夹，复用 `OssClient.list`），支持选根目录；对当前操作非法目标禁用确认
- [x] 4.2 桌面端右键菜单（`workspace_page.dart` 的 `_showDesktopItemMenu`）新增「移动到…」项，按身份能力显隐，触发目录选择对话框
- [x] 4.3 移动端条目操作菜单（更多/长按）新增「移动到…」入口，行为与桌面一致
- [x] 4.4 批量操作栏新增「移动」按钮（仅写入与删除能力可用），走同一目录选择与冲突流程
- [x] 4.5 移动进行中状态：目标/源目录列表页展示进行中提示，移动期间禁止再次发起（入口禁用），完成后统一刷新
- [x] 4.6 冲突对话框与结果反馈（成功/部分失败提示、失败对象信息）

## 5. 测试与验证

- [x] 5.1 为移动核心逻辑补充单元测试（参照 `test/workspace_batch_operations_test.dart`）：单文件、文件夹递归、空文件夹、父+子重复选择、目标为子目录被拒、同名冲突三选项、幂等重跑
- [x] 5.2 为断点恢复补充测试：manifest 残留检测、继续（幂等）、撤销（含源位置被占自动改名）、完成删 manifest
- [ ] 5.3 双端手工验证：macOS（右键菜单 + 批量栏 + 面包屑对话框）与 Android（更多菜单 + 长按 + 对话框），启动命令注入 `env/local.json`；验证移动后列表/缩略图/详情/回收站/相册不受 `.moves/` 前缀影响

## 6. 文档与收尾

- [x] 6.1 核对并按需更新 `docs/Flutter架构设计.md`（新增 widget 与 AppController 职责说明）
- [x] 6.2 在 client 子仓库提交实现，主仓库更新 submodule 指针并提交本 change 的规格产物

## 7. 性能修订（D7/D8，实施期新增）

- [x] 7.1 `OssClient` 提供仅列举目录子文件夹的轻量方法（复用/对齐 `listPrefixes`），目录选择对话框数据源从 `listDirectory` 切换过去，去掉每目录 1+F 次的子文件夹内容统计请求
- [x] 7.2 `_runMovePlan` 改为边列举边搬运：递归列举每返回一页 key 即按批（并发 6）执行 copy → 批内 deleteMany，列举与搬运流水线并行；`undoPendingMove` 反向搬运路径同步流式化
- [x] 7.3 `MoveProgress` 增加"仍在统计"标记；进度横幅维持「已处理/总数」展示、总数随列举递增，总数旁展示统计中图标（悬浮提示"仍在统计待迁移文件总数"），列举完成后标识消失
- [x] 7.4 单元测试补充：流式执行下逐对象 copy 先于源 delete 的不变式、列举未完成时进度总数递增、中断残留（一页内双侧重复）的续迁幂等
- [ ] 7.5 双端手工验证：确认移动后无 0/0 空转阶段、大文件夹移动进度平滑递增、目录选择对话框进出目录明显变快（对照修订前）
