# Wolf 代码导读：从启动到库存写入设计

核对日期：2026-09-15。本文以当前源码为准；第 1–8 节解释已实现行为，第 8 节同时记录库存写入的严格边界和后续扩展方向。本文不是“所有 Wolf 版本兼容”的承诺。

## 1. 先纠正三个容易混淆的概念

- **DLL 注入不等于数据库 Hook。** 当前没有替换数据库函数、挂接游戏更新循环或拦截获得道具事件。injector 使用过入口点断点，但恢复原字节后就脱离调试；数据库访问是 DLL 工作线程中的特征扫描和内存读取。
- **找到数据库不等于知道哪个字段是金币。** 原生层解释地址、数组和字段类型；JS 规则才解释队伍、金币、物品与持有数量。游戏完全自定义这些约定时，规则可能不识别。
- **UI 显示数量 0 不等于游戏已分配一个可写的 0。** 定义存在、库存读取成功但没有对应行时，UI 合并结果是 0；并没有创建游戏记录。

先记住三个兼容性层次：进程可注入 → 数据库布局可读 → 业务语义可识别。任何一层成功都不能证明下一层成功；可读也不能直接证明可安全写。

## 2. 阅读地图：每一层负责什么

以下路径均相对仓库根目录；优先按函数名定位，避免依赖不断变化的行号。

| 入口 | 要回答的问题 |
| --- | --- |
| `src/engine/wolf/detect.js`：`detectWolf/readPE` | 为什么被判断为 Wolf、为什么支持或拒绝启动？ |
| `src/electron/services/gameSessionService.js`：`launch/update/finish` | 谁拥有当前游戏会话？状态何时变化？ |
| `src/electron/engines/wolfDriver.js`：`createWolfDriver` | Electron 怎样启动 helper、验证握手、发数据库请求？ |
| `native/injector/main.cpp`：`wmain/initializeLoader/remoteLoadLibrary` | 游戏怎么暂停、加载 DLL、恢复？ |
| `native/wolf/main.cpp`：`DllMain/bootstrap` | DLL 的线程何时开始、运行期间做什么？ |
| `native/wolf/database_reader.h`：`locate/database/table/cellJson` | 特征码怎样变成单元格的真实地址？ |
| `src/electron/wolf/databaseProtocol.js` | 请求如何关联响应、验证范围并超时？ |
| `src/electron/wolf/databaseSemantics.js`、`goldMonitor.js` | 如何判定金币、按焦点刷新及受控写入？ |
| `src/engine/wolf/databaseMapping.js`：`discoverCollections` | 如何发现不同游戏的定义表和库存表？ |
| `src/game/adapters/wolfCollections.ts` | 如何用定义和背包合并出一页数据？ |
| `src/ui/CheatMenu/CollectionBrowser.tsx`、`InventoryTable.tsx` | 如何完整加载、刷新和显示？ |

## 3. 点击启动之后发生了什么

```text
React → preload → IPC → gameSessionService.launch
  → 检测 Wolf / PE 位数 → wolfDriver.launch
  → inject-x86.exe（独立进程、管道服务端）
  → Game.exe（游戏主线程 + ctool-wolf-x86.dll 工作线程）
```

### 3.1 检测与会话

`detectWolf` 检查 Data/BasicData.wolf 或 Data/BasicData 以及 EXE 中的 WOLF RPG Editor 标记，再读取 PE Machine。当前仅允许 x86 非 DLL；哈希和版本用于诊断，不是启动白名单。文件夹标记和字符串检测也不是对任意启动器的识别保证。

`gameSessionService.launch` 创建 sessionId，禁止同时拥有两个未结束会话。`wolfDriver.launch` 检查原生组件存在且为 x86，生成 nonce，以游戏目录作为工作目录启动 helper，并隐藏 helper 窗口。Electron 可以是 x64，因为它只通过标准输入输出控制 x86 helper；真正加载到游戏内的 DLL 必须匹配游戏位数。

### 3.2 原生启动和注入

`wmain` 的顺序：

1. 校验游戏与 DLL 的 PE；创建当前用户 ACL 的命名管道，拒绝远程连接。
2. 设置 CTOOL_WOLF_PIPE、CTOOL_WOLF_SESSION、CTOOL_WOLF_NONCE 环境变量，由子游戏继承。
3. `CreateProcessW` 使用 `CREATE_SUSPENDED | DEBUG_ONLY_THIS_PROCESS` 创建游戏，发送 `spawned`。
4. `initializeLoader` 恢复线程，让 Windows loader 继续；根据远程 PE 的 AddressOfEntryPoint 临时写入 `0xCC`。
5. 命中入口点时恢复原字节、将 EIP 调回入口地址，显式挂起主线程，继续调试事件并脱离调试器。这样停在游戏入口而不是仍持有 loader lock 的初始系统断点。
6. `VirtualAllocEx + WriteProcessMemory` 在游戏内放入 DLL 路径。`remoteLoadLibrary` 查找实际拥有 LoadLibraryW 导出的模块，以目标模块基址加导出偏移求远程地址。
7. `CreateRemoteThread` 调用 LoadLibraryW；等线程完成且返回非零后释放路径缓冲区，恢复游戏主线程，发送 `injected`。
8. helper 保留游戏进程句柄，转发通信并等待真正的游戏退出。

这段代码修改过入口机器码，但不是长期数据库 Hook。当前注入代码有 x86 EIP、32 位指针等假设，不能只把产物重命名为 x64 就支持 64 位游戏。

### 3.3 DLL 启动不代表数据库已初始化

`DllMain` 禁用线程通知，创建 bootstrap 线程，不等待该线程；耗时工作在 bootstrap 中执行。bootstrap 连接继承的管道，先发送 `hello`，声明 databaseProtocol=1、goldWriteProtocol=1，再调用一次 `reader.locate()`。

所以 hello 只说明通信和协议就绪，**不是数据库定位成功的报告**。特征未命中时仍可能看到“DLL 已连接”；此后读请求才返回 pattern_not_found。找到根地址但游戏还未完成数据库构造时则返回 database_not_ready。

## 4. 特征码如何变成数据库地址

### 4.1 `DatabaseReader::locate` 的扫描

代码读取当前 Game.exe 模块的 PE，限制为 I386，只扫描有执行权限的节。每次读 32768 字节并保留模式长度的重叠，避免模式横跨批次被漏掉。

当前只有一组初始化代码模式，不是一个覆盖全部版本的签名库。模式中 `-1` 表示任意字节：

```text
6A 01 51 B9 ?? ?? ?? ?? E8 ?? ?? ?? ??
FF 35 ?? ?? ?? ?? B9 ?? ?? ?? ??
[ C7 05 ?? ?? ?? ?? ?? ?? ?? ?? ] × 9
E8 ?? ?? ?? ?? B9 ?? ?? ?? ??
```

模式前段长 24 字节，第一条 `C7 05` 指令的 imm32 位于匹配起点 +30。当前实现从这四字节读取 root_ 值。**它不是“匹配地址加 30 就是数据库”**，而是读取那里编码的值作为后续定位入口。这个约定来自现有逆向候选，仍需每类构建的反汇编与布局证据支撑。

只接受唯一命中，且 root_ 在模块映像范围内；零命中、多命中、入口越界分别拒绝。bootstrap 目前只扫描一次，没有动态解包后自动重扫功能。

### 4.2 `database(kind)` 的指针链

用 `u32(A)` 表示从地址 A 读取一个 32 位无符号值：

```text
shared = u32(root + 8)
用户数据库 kind=0：db = u32(shared + 12)
可变数据库 kind=1：db = u32(shared + 16)
系统数据库 kind=2：db = u32(root + 8) = shared
```

随后要求 `u32(db + 4) == kind`。用户数据库主要提供定义，可变数据库主要提供运行状态；系统数据库提供系统配置等。这里只解释当前可读结构，不意味着任何游戏业务都固定放在同一张表。

一个 Vector 是三项 uint32：begin/end/capacity；元素数为 `(end-begin)/stride`。代码检查大小、顺序、元素整除与上限，不把任意数字当指针。

| 对象位置 | 内容 / 步长 |
| --- | --- |
| db +20 | 数据表对象 Vector，候选步长 0x54 或 0x20 |
| db +32 | 元信息表 Vector，对应候选步长 0xE8 或 0xE4 |
| 表数据对象 +0 | 字段描述符 Vector，每项 4 字节 |
| 表数据对象 +12 | 记录 Vector，每项 36 字节 |
| 表元信息 +0 | 表名字符串对象 |
| 表元信息 +0x60 | 记录名称 Vector，每项 24 字节 |
| 表元信息 +0x78 | 字段名称 Vector，每项 24 字节 |

两种步长组合分别尝试，通过数据表/元信息表数量一致及首表结构校验来选择，必须唯一。不是按版本号盲选；首表通过也不证明后续表都有效，后续访问仍会校验。

`table` 要求记录名数量等于记录数量、字段名数量等于描述符数量。之前把 +0x60 与 +0x78 混淆会把“一行七字段”解释错，原生夹具专门覆盖这次回归。

### 4.3 `cellJson` 如何读一个数字

字段编号不是数字数组下标。先读字段描述符 d：1000–1999 为数字槽，2000–2999 为字符串槽。

```text
record = records.begin + rowId * 36
数字 Vector 在 record +0
字符串 Vector 在 record +12

d = u32(fields.begin + fieldId * 4)
数字地址 = numericVector.begin + (d - 1000) * 4
字符串对象 = stringVector.begin + (d - 2000) * 24
```

数字读为 int32；字符串对象读取 24 字节，其中长度/容量在第 4/5 个 uint32 槽，容量小于 16 时取对象内短字符串，否则跟随指针；先尝试 UTF-8，失败使用 CP932。此为当前布局假设，不是所有编译器的通用字符串 ABI。

读取调用 `ReadProcessMemory(GetCurrentProcess(), ...)`：DLL 已在游戏里，所以读的是本进程，不是 Electron 跨进程查地址。地址不可读或不支持的单元格在 page 中变成 null，整表布局错误则返回 unavailable。

`unchanged` 会比较读取前后的顶层 Vector，降低读档/扩容期间读错结构的风险；它不是全数据库锁，也不能保证多页数据来自同一时刻。每个请求重新沿根解析地址，避免长期缓存堆地址；root_ 本身仍是启动时扫描出的入口。

## 5. 游戏运行时：谁主动读取，怎样回到 UI

### 5.1 通信格式

```text
读取调用 → createDatabaseRpc
  → helper stdin：page requestId kind table start limit fieldStart fieldLimit\n
  → helper commands：4 字节长度 + 命令文本
  → DLL bootstrap：解析命令，调用 reader.page
  → 4 字节长度 + JSON rpc（含 requestId/sessionId/nonce/pid）
  → helper stdout：一行 JSON
  → wolfDriver 验证身份 → databaseRpc.accept → 对应 Promise
```

`catalog` 每次最多 8 张表（每表目录最多 64 个字段）；`page` 最多 10 行、16 字段。RPC 最多 8 个在途请求、10 秒超时。超时响应被丢弃，不自动重发写操作。目录字段上限也意味着更后面的业务字段目前可能不参与自动识别。

bootstrap 约每 100ms 检查一次输入，每轮至多处理 4 帧，约每秒发心跳。数据库处理与心跳在同一工作线程，耗时请求也会延迟心跳。helper 检查管道客户端 PID，driver 再验证 sessionId/nonce/pid/protocolVersion；这是通信身份验证，不是验证字段语义。

### 5.2 金币：按焦点读取并推送

hello 后 driver 启用 RPC 并启动 `goldMonitor`。未绑定时分批读可变数据库目录，`identifyGold` 要求单行表、数字货币字段；强候选还要求队伍表名及至少四个数字成员字段，并排除历史/存档类表。唯一强候选才自动绑定。不是仅看到“所持金”三个字就写，也不是直接用 MY 的表号。

绑定后读取目标单元格，成功经 `telemetry.gold` 更新会话 revision，再通过会话事件进入 `GoldReadout/GoldEditor`。首次连接、CTool 获得焦点、手动切换来源及金币写入确认后才发起读取；没有后台秒级轮询。这不是金币变化事件 Hook，而是按用户回到工具时同步一次。

### 5.3 库存：渲染层按需拉取

`useGameFeatures` 选择会话绑定的 Wolf adapter，暴露可选 collections；它没有把 Wolf 强行接入 MV/MZ 的固定 items/weapons/armors feature。

`collections.list()` 获取用户库与可变库目录，交给 `discoverCollections`：

- 表名/字段别名和字段类型识别道具、武器、防具、合并装备。
- 通过【RPG】等前缀划分命名空间，定义表和持有表只能同组关联。
- 唯一定义表、唯一名称字段；库存候选必须为符合持有数量约定的单数字字段表。
- 当前只对存在基本系统队伍证据的无前缀分组启用 `basic-system-readonly`。其他分组可能只展示定义或保留候选；此证据仍是启发式规则，不是引擎强类型保证。

`wolfCollections.page(key,start)` 按 10 行读名称、说明；再探测库存实时总行数，按相同记录 ID 读对应数量。过滤空名/分隔行后不能重新编号。成功读取且不存在持有行才补显示 0；null、截断、读取失败或未确认映射保持未知。

MY 的咖啡 ID 56、奶茶 ID 57、巧克力 ID 68 与数量 1/1/3 是已有样本证据，不是规则里的常量；资料表 2、库存表 7 同样不能成为跨游戏硬编码。

`CollectionBrowser` 连续拉完一个分类的所有批次后一次更新 rows，使用共用 InventoryTable 虚拟滚动展示；首次打开、CTool 获得焦点或点击刷新时才重新读取。虚拟滚动只减少 DOM 数量，并不意味着只读可见行。

首次启动是唯一例外：DLL 握手完成不代表 Wolf 已构造运行时数据库。Wolf 页面会先显示加载遮罩，并只在这一段以 500ms 间隔重试 `collections.list()`；目录和分类成功读出后才解除遮罩，同时刷新一次金币。进入正常使用后不会保留后台轮询，后续只在 CTool 获得焦点、手动刷新或写入成功后同步，避免覆盖正在编辑的数值。

## 6. 已有金币修改：一笔写入的完整过程

```text
GoldEditor 显式应用（新值 + 编辑时旧值/来源）
→ Wolf adapter.setGameGold
→ preload.setGameGold → game:gold-write
→ gameSessionService.setGold → wolfDriver.setGold
→ goldMonitor.write → RPC goldwrite → DLL reader.writeGold
→ 原生回读结果 → telemetry → UI，并刷新当前分类一次
```

主进程验证当前会话、协议和绑定来源；monitor 在写入期间拒绝刷新，用 generation 丢弃过期结果，重新读取旧值及字段结构后再发送命令。原生要求 kind=1、有效数字槽、非负 int32 新值、已存在记录、4 字节对齐和可写页面；重新验证 Vector/描述符后执行 `InterlockedCompareExchange(address, desired, expected)`。

旧值不同则冲突，不覆盖游戏新数值；CAS 成功后重新解析数据库回读，不直接把请求值当结果返回。写后不一致属于“结果未确认”，不能自动重试，也不意味着已经撤销写入。

注意两层边界：主进程确认“这是当前绑定金币”；原生 writeGold 只知道“可变库的某个数字单元格”，它并不理解金币含义。现有原生函数也没有与游戏主线程协作：CAS 只使一个整数的比较交换原子化，无法阻止校验后发生向量迁移、地址复用或多字段业务变化。不要将这套保护表述成完整事务保证。

修改发生在运行内存，不直接修改存档；游戏以后如何保存由游戏流程决定。

## 7. 生命周期和故障如何定位

状态通常为 launching → connecting（spawned）→ initializing（injected）→ degraded（hello）。degraded 是当前有限能力会话，不代表连接坏了；MV/MZ 的完整 ready 能力不被套用到 Wolf。通信断开会 failed、撤销能力，但不能直接 closed；真实游戏退出事件才结束会话。

| 现象/原因码 | 检查位置与含义 |
| --- | --- |
| 不支持启动 | detect.js；位数、EXE 类型、引擎文件标记 |
| 无 injected | injector 的 loader/路径分配/远程 LoadLibrary 阶段 |
| 有 injected 无 hello | DLL 环境、bootstrap、管道连接与握手 |
| pattern_not_found / pattern_ambiguous | locate；模式零命中/多命中，尚未进入业务映射 |
| database_not_ready | 根指针链/数据库 kind 校验，可能尚未初始化 |
| database_layout_mismatch / table_layout_mismatch | 步长或字段/记录 Vector 对不上，不能靠改 UI 修复 |
| 数据库可读但金币未知 | identifyGold 的候选、唯一性、字段别名 |
| 名称可见但数量未知 | discoverCollections 配对状态或库存 page 失败，区分语义与内存问题 |
| 显示 0 却没有可写行 | UI 的缺省合并值，不是漏读一页，也不是写入许可 |
| gold_value_conflict / write_unconfirmed | 分别为旧值冲突、写后未确认，先读取和核对游戏 |

当前没有完整逐请求持久化追踪日志；不要假定磁盘已有每步地址记录。排查时先用 DEV 数据库页核对 kind/table/row/field，再对照以上函数或调试器；不要先增加游戏特判。

## 8. 库存/装备数量修改：当前范围与后续设计

### 8.1 先明确改什么

第一阶段已实现“已注册物品或装备的背包持有数量”：已确认基本系统、且数量表已存在该记录时，可写入非负整数；0 是删除，正数是添加或设定数量。不修改道具定义的价格、效果，不修改角色已穿装备槽，也不执行使用道具事件。装备数量和角色穿戴是不同业务：穿戴还可能影响属性、背包增减和菜单刷新，必须另做引擎调用研究。

必须拆开三种行状态：已有库存行且可读、缺少库存行但展示默认零、库存不可用。现有 owned:number 无法表达前两者的区别，因此不能直接给所有数字行加输入框。

### 8.2 已实现的写入链路

```text
InventoryTable 数量输入（仅可写行）
→ CollectionBrowser / wolfCollections.setCount
→ preload → game:inventory-write → gameSessionService
→ wolfDriver.inventorywrite RPC → DLL writeGold 的受限数字槽写入
→ 回读确认 → CollectionBrowser 刷新该分类
```

`inventorywrite` 是独立协议，仍限制在可变数据库、已存在记录、数字字段、非负 int32 与预期旧值一致。DLL 当前复用同一受限数字槽写入实现；主机映射决定这是经过确认的背包数量。缺行和未确认映射不会出现输入框。

### 8.3 后续需要扩展的文件

以下接口名是提案，不是已存在的 API：

| 层 | 计划变更 |
| --- | --- |
| `src/game/database.ts` | 行数据增加库存存在性、可写状态/原因；collections 增加可选 setCount；读能力与写能力分离 |
| `databaseMapping.js` | 为规则增加 ruleId、关联策略及写入验证状态；不要把 readonly 规则自动升级可写 |
| `wolfCollections.ts` / `wolf.ts` | 传 collectionKey、原始 itemId、旧数量、新数量和映射版本，不传任意内存地址 |
| preload / global.d.ts / IPC handlers | 新建专用 `setGameCollectionCount` 与 `game:collection-count-write`，同步参数类型 |
| gameSessionService / wolfDriver | 校验会话、写协议；在主进程重新发现/验证映射，不能信任渲染层给的 table/field |
| 新 `src/electron/wolf/inventoryService.js` | 管理会话映射、写入串行化、expected 校验、回读及失败分类 |
| databaseProtocol / injector commands / DLL bootstrap | 新增独立库存写命令和版本能力；继续禁止通用 database-read IPC 接收写操作 |
| database_reader.h 或独立 writer | 提取受限已有数字槽解析；不得借 goldwrite 名义绕过库存校验，不自行扩容 |
| CollectionBrowser / InventoryTable | Wolf 使用显式提交与逐行可写判定；保留 MV/MZ 默认失焦提交和既有上限 |

主进程可复用纯映射规则，但当前映射是在 renderer 侧做的，**并不存在可以直接信任的主进程库存绑定缓存**；新增写服务必须补上这层。也不应照搬共用表格默认的 99 为 Wolf 全游戏数量上限。

建议请求形状（伪代码）：

```ts
setCount({ sessionId, collectionKey, itemId,
  expectedCount, desiredCount, mappingRevision })
// 由主进程重新验证后得到受限目标，渲染层不能自行授权目标地址。
// 成功返回 observedCount；失败区分 conflict / unsupported /
// missing-record / changed / unconfirmed，不能一律显示“失败未修改”。
```

### 8.4 已有行：可复用什么，缺什么

可复用金币的数值范围检查、重新解析指针、预期旧值比较、CAS 与回读，但这只是底层机械操作。还要验证唯一库存关系、真实定义 ID、数量上限与游戏对库存的业务处理。

若先做已有行实验，应明确标成有限的后台单值写，不能宣称解决读档并发；默认不开启未验证规则。更可靠的扩展路线是找到游戏主线程的安全调度位置，把写任务排到那里，或调用已验证的引擎/基本系统库存操作函数。目前这些入口、调用约定、对象参数和线程边界都尚未确定，不能在方案里编造函数地址。

### 8.5 缺少行：不能直接写零值所在位置

当 itemId 大于等于运行时库存行数时，不存在数字槽。不能通过 `begin + itemId * stride` 越界写，也不能只抬高 Vector.end：记录构造、名称 Vector、字符串/数字子数组、分配器和扩容可能需要一起更新。

阶段一应禁用该行修改并说明“尚未分配库存记录”；这不改变显示 0 的规则。阶段二研究游戏正常获得该物品的流程，确认它怎样扩容或调用数据库 setter，再通过游戏自身机制创建。没有明确机制前，不自行创建 C++ 容器对象。

### 8.6 人工逆向需要交付什么证据

对自己准备的测试游戏，由开发者操作游戏，工具先只读记录：

1. 找一个已有物品，记录定义 ID、持有表、字段、当前值；在游戏里正常消费/获得一次，看哪个值变化。
2. 在调试器对**本次解析的数量地址**设写入观察，记录执行模块+RVA、指令、调用栈、寄存器、线程；读档后地址可能变化，不能永久使用旧地址。
3. 在安全备份的测试进度里正常获得一个此前没有库存行的物品，对照前后 rowCount、records 与子数组指针，观察扩容发生在哪里。
4. 分别观察数量归零、重新获得、装备穿上/卸下、存档读取后的行为。确认物品 ID 参数、数量参数、上限和返回值，区分引擎通用 setter 与游戏公共事件逻辑。
5. 在第二个结构相同但表号不同的游戏复核；保留模式周围反汇编与布局证据，不仅记录一个绝对地址。

这些证据才能决定是“已有数字槽写入规则”还是“游戏线程中的库存 API 调用”。只靠一次改值成功不足以启用跨游戏写功能。

### 8.7 验证门槛与下一步

先补测试再开放 UI：重排表/字段 ID、不同行数、默认零但缺行、未知映射、数量冲突、切换会话、响应超时、只读页、无效指针、回读不同值。库存写协议必须独立测试，goldwrite 不能成为任意数据库写后门。

已有验证入口：`tests/wolf/mapping.test.js`、`collectionAdapter.test.js`、`database.test.js`、`session.test.js`、`driver.test.js`，以及 `native/tests/database_reader_test.cpp`。Node 测试验证编排/规则，不证明真实游戏 ABI；原生夹具证明构造布局下的解析/保护，不证明多游戏兼容。

建议下一次开发的最小范围：**先增加行级库存存在性和诊断，不开放写入；然后用一个已有行完成“游戏操作 → 地址 → 调用栈 → 规则”的人工验证，再实现独立的受限库存写链路。** 缺行创建和角色穿戴分别排后续任务。

开发者完成阅读后，应能独立回答：模式 +30 存的是什么？字段 ID 为什么不直接乘 4？哪些时机读取金币？库存 0 是否有实际内存？CAS 保护了什么、没保护什么？若不能回答，应在对应层停下来验证，而不是继续叠功能。
