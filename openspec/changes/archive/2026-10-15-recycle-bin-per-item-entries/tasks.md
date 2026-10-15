# Tasks

## 1. 规格与设计

- [x] 1.1 新建 change 目录，编写 proposal.md 与 design.md
- [x] 1.2 编写 specs/recycle-bin/spec.md 规格 delta

## 2. 控制器按条目建回收条目

- [x] 2.1 `BatchDeletePreview` 增加 `items` 字段；`prepareBatchDelete` 传入选中条目，`retryBatchDelete` 从失败路径合成单对象条目
- [x] 2.2 重构 `_moveToRecycleBin` 为逐项建条目：逐项并发复制 + 逐项写 manifest、跨条目累计进度、全部复制完成后统一批量删除源对象
- [x] 2.3 新增重名检测与命名：读取既有条目 name 集合一次，`_uniqueRecycleBinName` 在扩展名前追加 `_yyyyMMdd_HHmmss`，冲突时重试直到唯一
- [x] 2.4 `deleteItem`/`deleteBatch` 适配新签名与按条目分组逻辑
- [x] 2.5 单元测试覆盖：多选逐项建条目、同名时间戳命名、单删/目录删既有行为不回退

## 3. 回收站页面平铺根列表

- [x] 3.1 `_itemsFor` 根层按条目平铺（entry.id 为 key），子层按原路径前缀展开虚拟目录树
- [x] 3.2 `_open`/`_openPreview` 适配根层条目路径映射与预览路径解析
- [x] 3.3 立即删除确认文案由"该批次"改为"该项"

## 4. 验证与文档同步

- [x] 4.1 测试桩补充 `listPrefixes`/manifest 读取支持，`flutter test` 全量通过
- [x] 4.2 `flutter analyze` 无新增告警
- [x] 4.3 同步 `docs/Flutter架构设计.md` 与 `docs/技术文档.md` 回收站相关描述
- [x] 4.4 macOS 手动走查：删除单文件/文件夹/多选、同名重复删除、文件夹钻取、恢复与立即删除
