# Tasks

## 1. 数据模型与序列化

- [x] 1.1 在 `client/lib/features/transfer/domain/transfer_task.dart` 新增 `queuedAt`、`startedAt`、`lastStartedAt`、`finishedAt`、`activeDurationMs`、`totalTransferredBytes`、`attemptCount` 字段，默认值保证旧构造调用不变；用 `flutter analyze` 与现有传输测试验证无编译回归
- [x] 1.2 更新 `copyWith`、`toJson`、`fromJson`，时间统一以 UTC epoch 毫秒序列化，缺失字段按未知或默认值恢复；补充往返序列化与缺失字段解析测试并通过
- [x] 1.3 为旧记录实现 `queuedAt` 的 `id` 微秒时间戳兜底解析，并补充合法/非法 `id` 的单元测试

## 2. 队列计时与统计

- [x] 2.1 在 `client/lib/features/transfer/application/transfer_queue.dart` 的 `_runTransfer` 中接入 `Stopwatch`，在 `finally` 统一累加 `activeDurationMs` 与 `totalTransferredBytes`；补充成功、失败、取消、暂停继续的计时单元测试并验证累计值正确
- [x] 2.2 在任务首次进入 running 时写入 `startedAt`，每次进入 running 更新 `lastStartedAt`，进入终态写入 `finishedAt`，重试入队时清空 `finishedAt`；补充状态迁移时间字段测试
- [x] 2.3 在 `transfer_controller.dart` 及相关控制器中维护 `attemptCount`：创建任务置 1，用户重试 +1，暂停继续不增加；补充重试与暂停继续的计数测试
- [x] 2.4 在任务模型上提供平均速度派生计算（累计字节 / 累计传输时长），时长为零或总字节未知时返回空；补充除零与未知大小测试

## 3. SQLite 历史存储

- [x] 3.1 新增 `client/lib/features/transfer/infrastructure/transfer_history_store.dart`：SQLite 表 `transfer_history`、`finished_at` 与 `(type, finished_at)` 索引、upsert、按 id 删除、分页查询、按类型计数与清理方法；通过可覆写实现便于测试，并用内存实现验证表字段映射与查询排序
- [x] 3.2 将 `transfer_queue.dart` 的历史恢复与写入切换到 `TransferHistoryStore`：启动异步加载第一页 300 条，终态变化合并为约 300ms 的单事务批量 upsert，清除已结束任务同步删除数据库行；补充队列读写路径测试并验证大批量终态不会逐条重写
- [x] 3.3 实现首次升级迁移：读取现有 `transfer_history:v1`，事务导入后写入 `transfer_history_migrated` 标记，旧键保留不更新；补充重复启动不重复导入、缺失字段兼容与损坏 JSON 的测试
- [x] 3.4 实现保留清理：删除结束时间早于 90 天的记录，再按结束时间保留最多 20000 条，启动时与写批次后节流执行；补充 90 天边界、超上限淘汰与单批 300 条不误删的测试
- [x] 3.5 实现历史分页与计数：每页 300 条按结束时间倒序，滚动加载下一页不重复不遗漏，类型计数包含未加载历史；补充分页与计数一致性测试
- [x] 3.6 将失败任务纳入历史并在用户重试时移出、成功后重新写入；补充失败记录重启可见与重试过程的测试

## 4. 展示层

- [x] 4.1 在传输展示层新增共享格式化函数（字节、速度、时长、绝对时间），实现今天/昨天/同年/跨年格式与占位符；补充格式化单元测试覆盖边界日期与未知值
- [x] 4.2 调整桌面与移动端已结束任务卡片，展示文件大小、结束时间、耗时与平均速度；补充已结束卡片在成功、失败、取消、旧记录四种情况下的组件测试
- [x] 4.3 调整排队中与进行中卡片，展示已等待/已用时长，并仅在存在未结束任务时启用 1 秒刷新定时器、页面销毁或任务全部结束时取消；补充定时器生命周期测试
- [x] 4.4 实现任务详情视图（移动端底部弹层、桌面对话框），展示完整时间线、排队耗时、总耗时、传输耗时、平均速度、文件大小、尝试次数与失败原因；补充成功、失败重试、字段缺失三种详情测试
- [x] 4.5 将任务排序改为未结束按 `queuedAt`、已结束按 `finishedAt` 倒序并保持稳定，比较器以 `id` 兜底；补充重启恢复后的排序测试
- [x] 4.6 实现历史分页交互：滚动到已结束记录底部加载下一页、展示加载状态、没有更多时停止请求；类型筛选计数改为读取队列提供的完整计数；补充加载更多与计数展示的组件测试

## 5. 文档同步

- [x] 5.1 更新 `docs/技术文档.md` 10.2/10.3，补充任务时间线字段、计时口径、平均速度定义与 SQLite 历史存储、90 天/20000 条保留策略说明，并核对与实现一致
- [x] 5.2 更新 `docs/Flutter架构设计.md` 传输持久化与展示章节，说明 `TransferHistoryStore`、旧数据迁移、分页加载、失败记录纳入与暂停/重试计时口径，并核对与实现一致

## 6. 集成验证

- [x] 6.1 在 `client/` 执行 `flutter analyze` 与 `flutter test`，确认全量通过
- [ ] 6.2 使用 `flutter run -d macos --dart-define-from-file=../secrets/client/local.json` 实测：一次 300 个文件的批量上传、下载记录时间线、暂停继续、失败重试、旧历史迁移、分页加载与重启后排序，并记录验证结果
  - 已验证：`flutter build macos --debug --dart-define-from-file=../secrets/client/local.json` 构建通过；真实批量上传与运行时交互手测未执行（需真实 OSS 数据，待人工验证）
- [ ] 6.3 使用 `flutter run -d android --dart-define-from-file=../secrets/client/local.json` 复测移动端大批量任务卡片、统计行、分页加载与详情视图，并记录验证结果
  - 已验证：`flutter build apk --debug --dart-define-from-file=../secrets/client/local.json` 构建通过；真机 UI 手测未执行（待人工验证）

## Workflow follow-up

- 客户端改动在 `client/` 子仓库提交后，回到主仓库更新 submodule 指针。
- 评审通过后归档变更，并同步 `openspec/specs/transfer-task-history` 与 `transfer-queue-management` 主规格。
