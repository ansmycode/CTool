# Wolf 库存合并与页面复用

## 当前行为（2026-09-14）

以所有已注册物品/装备定义为主表，用玩家库存按 ID 覆盖持有数量。对于已经识别并成功读取的库存，缺少对应条目的定义显示 0，包括数量表尚未分配该行的情况。这是显示层的默认数量，不创建游戏记录。

读取失败、字段值损坏、响应不完整或映射尚未确认仍为不可用，不能作为空背包处理。库存范围使用运行时总行数，保留分批读取和游戏运行时扩容支持。

此规则取代早期 WOLF_MAPPING.md 中“缺失库存行显示未建记录”的展示决定。

## useGameFeatures 评估

现有 useGameFeatures 适合 MV/MZ 的固定 feature 槽（items/weapons/armors）和修改后整项刷新。Wolf 能出现多个同类数据库命名空间，也可能使用合并的 equipment 类别；目前独立的 collections 接口更能保留这些分组。

直接把 Wolf 强行接到旧 items 等槽还会遇到三个问题：会话 capabilities 目前没有这些能力；旧物品页面默认每行可编辑且上限为 99；一个槽无法表达多个同类系统。不能仅添加 readers 就宣称修改可用。

本轮选择共用展示组件，保留数据编排差异：

- InventoryTable 接收统一 id/name/playerHasCount 数据、可选说明、可选数量修改回调。
- MV/MZ 的 itemsTable/weaponTable/armorTable 成为薄包装，继续经 useGameFeature 取数据并将 item/weapon/armor 传给原操作，上限仍为 99、仍失焦提交。
- Wolf CollectionBrowser 继续负责动态分组、分批读取及活动页面刷新，将数据转成同一展示结构，未提供修改回调，因此数量只读。
- 共用搜索、虚拟表格、尺寸计算、数量显示与编辑草稿；无需长期维护两套表格 UI。

后续需要统一编排时，可以给 feature 增加集合标识及独立读/写能力，再将 collections 收入 useGameFeatures；本轮不改动现有 MV/MZ 服务或注入协议。
