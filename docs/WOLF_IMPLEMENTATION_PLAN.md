# CTool WOLF 引擎适配落地评估

更新：2026-09-13。代码基线：wolf 分支，17fb532。
状态：完整目标方案。P0/P1 启动与握手骨架已实施，真实样本已验证连接和退出，详见 [实施记录](WOLF_P1_STATUS.md)。下文“当前架构事实”指 17fb532 基线，其余未落地项仍为提案，不代表全部完成。

P1 的具体调整：Named Pipe 服务端放在 injector 中负责 ACL 和 PID 校验，经 stdio 与 Electron 通信；游戏启动采用临时 PE 入口断点等待 Windows loader 完成，再注入 DLL。当前 pipe 只传 hello/heartbeat，双向 RPC、文本与作弊能力留待后续。

## 1. 决策与范围

沿用现有“UI → useGameFeatures → 引擎 Adapter”的分层，新增主进程引擎驱动与统一会话层。Wolf 使用独立 x86 injector 启动游戏并加载 x86 DLL，经 Named Pipe 与 Electron 主进程通信。MV/MZ 保留现有插件和 HTTP 数据链路，仅将启动、就绪、退出事件接入统一会话。

首期只支持一个 EXE 指纹对应的 x86 样本，先实现文本捕获，再验证运行时翻译；作弊后续按读、写分别开放。首期不承诺整个 Wolf 2.x/3.x，不实现离线封包内嵌、存档隔离、变速、穿墙或多游戏并行运行。

本文件作为正式方案存放于 docs。agent_work/wolf_analysis 被 .gitignore 忽略，是本地逆向证据目录，不应成为其他开发者理解架构的必需依赖。

## 2. 当前架构事实与接入缺口

| 当前入口 | 已有行为 | Wolf 接入所需调整 |
| --- | --- | --- |
| src/utils/gameUtil.js | 仅检测 MV 的 www 和 MZ 的根目录布局 | 增加主进程 detector registry；保留 MV/MZ 检测实现 |
| src/ui/Main/index.tsx | engine 为 MV/MZ 才调用 injectScript，返回布尔值 | 调用通用 launchGame；显示检测和会话状态，不写引擎分支 |
| src/electron/services/gameInjectionService.js | 单例保存进程与 MV/MZ 注入信息；监听直接子进程退出 | 迁出 MV/MZ driver；通用 session service 管理不同 driver |
| src/electron/server.js | 5001 的 /gameReady 直接向窗口发送布尔事件 | 将 MV/MZ 回调交给会话层；Wolf 不经过此端口 |
| src/game/registry.ts | MV/MZ 共享静态 adapter 实例 | 改为 adapter 工厂，绑定 sessionId；元信息用于静态展示 |
| src/game/types.ts | EngineType 已有 wolf；setGameGold/setSomeGameSettings 为必需方法 | 引擎类型存在不等于支持；方法按能力可选，不做空实现 |
| src/game/features.ts | overview/items/actors 等七类固定数据 | 保留已有类型；新增 Wolf 变量组和动态数据库类型 |
| src/game/useGameFeatures.ts | 从 reader 存在性推导能力，修改后刷新整个对应 feature | 使用会话能力交集；按 session 重置数据；Wolf 刷新选中页 |
| src/game/GameFeatureContext.tsx | 提供按 feature 的数据和 refresh | 继续复用；扩展请求参数和分页状态，不另造全局 store |
| src/ui/CheatMenu/index.tsx | 默认 Tab 1；依赖瞬时 game-ready 事件 | 改为快照 + 事件；选择首个可见 Tab，能力改变时回退 |
| src/ui/CheatMenu/tabRegistry.tsx | 能力过滤、懒加载；快捷键页无能力限制 | 新增 Wolf 专用 Tab；无快捷动作时隐藏快捷键页 |
| src/ui/CheatMenu/translateTool/index.tsx | 同一页包含实时加载、MV/MZ 提取、AI 翻译及禁用内嵌入口 | 拆分翻译子能力；Wolf 不显示 MV/MZ 文件操作 |
| src/electron/services/translationEngineAdapters.js | 仅处理 MV/MZ JSON 数据目录 | 首期保持；不能给 Wolf 注册同一个 JSON 处理器 |

两个具体兼容问题须随接入解决：
- sendTranslationData 当前约定 Promise<void>，翻译页却读取 res.success；统一成成功 resolve、失败 throw。
- init() 虽在 Adapter 契约中存在，CheatMenu 就绪实际依赖事件。就绪统一由主进程会话管理；迁移完成后删除未使用的 init，避免两套状态源。

## 3. 完整引擎适配链路

### 3.1 识别、启动、退出

~~~text
Main / GameHistory
  → preload.detectGame(exePath)
  → 主进程 detector registry
      ├─ MV/MZ：现有 core.js + System.json 检测
      └─ Wolf：PE 架构、版本资源、目录证据、EXE 哈希
  ← DetectionResult（引擎、架构、证据、支持状态）

Main → preload.launchGame(detectionId)
  → gameSessionService：重新核验路径/指纹，创建 sessionId
  → 主进程 driver registry
      ├─ mvmzDriver
      │   → 原插件注入 → spawn Game.exe
      │   → 5001 /gameReady → 会话状态
      │   → 游戏 exit → 原插件清理
      └─ wolfDriver
          → 创建 Named Pipe 和会话配置
          → spawn inject-x86.exe
          → 挂起创建 Game.exe → 加载 wolf-x86.dll → 恢复主线程
          → DLL hello → profile 验证 → 能力上报
          → injector 监视实际游戏句柄并上报 exit
  ← 会话快照 + session-changed 事件
~~~

检测与支持分开：能识别 Wolf、能注入 x86、某项功能可用是三个状态。检测失败返回明确的 unsupported/unknown，不再用字符串 Unknown 的 truthy 值判断“可以启动”。

历史记录只持久化游戏路径与显示信息，重新启动时重新检测；不保存可复用的 sessionId 或运行时能力。选择取消直接返回，不继续识别空路径。

### 3.2 运行时读取与修改

~~~text
CheatMenu → useGameFeatures(session)
  → renderer adapter registry / createAdapter(session)
      ├─ MV/MZ Adapter → 原 HTTP localhost:5000 → inject/cheat.js
      └─ Wolf Adapter → preload 的受限 game RPC
                        → 主进程 wolfDriver → Named Pipe
                        → DLL RPC → profile 定位对象
                        → 游戏线程命令队列 → 读取/修改
  ← 类型化结果 → 对应 feature / 当前页刷新
~~~

主进程 driver 负责系统资源和协议，渲染层 Adapter 负责类型与页面操作映射。两层 registry 职责不同，不应合并成包含 Electron/Node 依赖的前端模块。

## 4. 会话契约与生命周期

新增 src/types/GameSession.ts（纯 TypeScript 类型）以及主进程运行时校验模块。首期仍限制一个活动游戏；使用 sessionId 隔离迟到消息、重连与下一次启动，而非提前实现多游戏。

建议接口：

~~~ts
type SessionState =
  | "launching" | "connecting" | "initializing"
  | "ready" | "degraded" | "failed" | "closed";

interface GameSessionSnapshot {
  sessionId: string;
  revision: number;
  engine: "MV" | "MZ" | "wolf";
  state: SessionState;
  processState: "starting" | "running" | "exited";
  pid?: number;
  profileId?: string;
  capabilities: string[]; // 实现时收窄为枚举，禁止任意字符串
  unavailableReasons: Record<string, string>;
}

interface EngineDriver {
  launch(context: LaunchContext): Promise<LaunchHandle>;
  dispose(): Promise<void>;
}
~~~

LaunchHandle 封装实际 PID、启动/退出通知和释放逻辑；Wolf 额外由 driver 实现受限 RPC。接口实现不要求 MV/MZ 把原 HTTP 操作全部搬入主进程。

- preload 提供 launchGame、getGameSession、onGameSessionChanged 和限定操作的 Wolf 请求；同步 global.d.ts 与 IPC handlers。
- UI 先订阅，再取快照；只应用当前 sessionId 且 revision 更新的结果。处理启动完成前就到达 ready 的竞态。
- DLL 加载成功只进入 connecting；hello 表示协议连接；有效 Hook/对象验证后进入 ready 或 degraded。
- 文本已可用但数据库未构造完成时进入 degraded，后续增加数据库能力；失败原因逐项显示。
- 旧会话回包不得更新新会话 feature；切换 session 时清空状态、草稿、请求、翻译状态和快捷键注册。
- launch 防重复；error/exit/timeout 的 finalize 幂等，记录 history 的时机为确认实际进程创建成功后。
- 注入失败且游戏仍由本次启动保持挂起：只终止本次创建的子进程，释放资源。游戏已运行后的通信失败应显示失联，不冒充游戏退出。
- injector 异常退出但游戏仍运行：尽力通过实际 PID/创建时间确认存活；不能直接沿用“helper exit = game exit”。
- 工具关闭时不强杀正常游戏；DLL 断连后禁用写请求和翻译替换，保持安全透传。初期不强制 FreeLibrary，随游戏退出释放；动态卸载需另行证明 Hook 无执行中读者。
- MV/MZ 5001 回调无 sessionId，首期仅接受活动 MV/MZ 会话；旧回调仍有歧义，后续可让注入配置携带 nonce。Wolf 不发送旧 game-ready 布尔事件。

## 5. 能力和数据模型：复用框架，不伪装 MV/MZ 语义

GameFeatureDataMap 增加 wolfVariables、wolfStringVariables、wolfDatabases。每类结果应带查询范围和分页元信息；数据库使用稳定坐标 dbKind/typeId/recordId/fieldId，变量使用 groupId/index，避免不同变量组同 ID 冲突。

~~~text
WolfDatabaseSummary[] → 选数据库/类型 → 分页记录 → 字段值与字段类型
WolfVariableGroup[]   → 选组 → 分页变量
WolfStringVariable[]  → 分页字符串变量
~~~

不把 Wolf 的任意变量直接叫金币，不填造假的 actors/items/overview。只有后续确认特定游戏的数据语义，才引入“游戏专属规则”，与“引擎版本 profile”分开。

将 reader 能力与写操作能力分开，例如：
- wolf.variables.read / wolf.variables.write
- wolf.stringVariables.read / wolf.stringVariables.write
- wolf.databases.read / wolf.databases.write
- translation.capture / translation.exportCaptured / translation.runtime
- translation.extractFiles / translation.embedFiles / translation.backupRestore

GameCapability 保留现有 feature key，扩展明确的操作标识；translation 可保留为“有任一翻译子能力”的派生页面能力。实际能力 = Adapter 实现 ∩ driver/profile 验证结果 ∩ 当前会话状态。不能仅因某个函数定义存在就开放操作。

具体改动：
1. setGameGold、setSomeGameSettings 等 MV/MZ 动作改为可选；调用缺失动作抛 UnsupportedCapability，避免可选链静默成功。
2. useGameFeatures 保留 MV/MZ 的修改后刷新；Wolf 操作新增独立 typed 方法，刷新受影响的选中记录页。
3. reader 支持有类型的 query；缓存键包含 sessionId、feature、query。旧请求结果若查询已变更则丢弃。
4. 保留 GameFeatureProvider / useGameFeature，提供目标 feature 的 query/refresh；不用一个巨型对象读取全部 Wolf 数据。
5. tabRegistry 新增 Wolf 三类懒加载页面；Tab key 使用明确名称，新旧 key 不必一次全改。
6. activeKey 初始化及能力变化时选首个可见 Tab；没有任何可用能力时显示诊断页，不能永久 loading。
7. Wolf 首期 shortcutActions 为空；现有 overview 布尔开关逻辑仅供具有相应能力的引擎使用。
8. registry 的静态 supportedEngines 用于展示“实现支持”，会话动作集合用于真正注册快捷键；两者不能混用。
9. src/dev/FakeGamePreview.tsx / fakeGameData.ts 随类型扩展补空 feature，并增加 Wolf 分页/能力降级 mock。

## 6. 翻译链路

~~~text
DLL 文本 Hook → 有界采集队列 → 主进程缓存
  → 导出原文→原文 JSON → 现有 AITranslation / electron/ai
  → 用户选择纯净译文 JSON → 校验 → Wolf Adapter
  → preload → wolfDriver → 分块传输 → DLL 构造新表
  → 原子切换版本 → Hook 查表 → 经已验证的字符串赋值路径替换
~~~

- AI 请求仍在 Electron 主进程执行，DLL 不接收 API Key。
- 内部采集记录保存原始字节、codec、上下文和文本 ID；兼容现有 JSON 时按解码文本合并，记录多上下文冲突。第一版明确使用同原文同译文，不承诺上下文消歧。
- 控制符必须原样保护；显示用清洗文本不能直接作为回写字符串。
- 未知编码先只采集。CP932、UTF-8、UTF-16 由样本实际调用链证明，不按版本号猜测。
- 不可变映射解决的是翻译表并发，不会自动解决引擎字符串对象的线程安全和所有权。必须确认引擎分配/赋值方法，不跨 CRT 释放。
- 空表表示停止后续替换；已经写入持久对象的译文不保证自动恢复。首版卸载语义为“停止替换，重新显示文本或重启恢复”；完整恢复需额外跟踪原文与对象生命周期。
- 翻译页按子能力显示按钮。Wolf 显示采集/导出/实时加载；隐藏 MV/MZ applyFilters、ExtractModal 文件扫描以及内嵌备份还原。
- 现有内嵌按钮在当前 UI 已禁用，不因本次适配重新开放。AITranslation 继续复用，与 Wolf 的文件提取能力无绑定。
- sendTranslationData 统一 Promise<void>；await 成功后提示完成，异常提示失败，不读取不存在的 res.success。

## 7. Injector、DLL 与通信

### 注入器

第一版构建 inject-x86.exe 和 ctool-wolf-x86.dll。Electron x64 可以启动 x86 helper；DLL 必须与目标进程匹配。后续如果有 x64 样本，再构建对应 helper/DLL。

采用挂起创建 → 加载 DLL → 恢复主线程。用绝对路径和参数数组启动 helper，正确传递含空格/中文的路径，工作目录为游戏目录。helper 输出结构化阶段、PID 和 exit；DLL 路径存在、PE 架构和加载结果必须检查。远程加载成功不代表 Hook 已安装。

DllMain 最小化；bootstrap 在线程恢复后等待引擎运行时。Hook 重入保护、线程内异常边界、超时和失败透传都在原生层实现。

### Named Pipe

Electron 创建每会话唯一 pipe；Windows Named Pipe 的跨位数通信使用固定宽度字段，不传进程地址或 C++ 对象。pipe 限本地当前用户，验证 nonce、协议版本和对应游戏 PID。随机名称不能替代访问控制；若 Node 建管道方式无法提供所需权限，使用原生桥接或经过验证的等价限制。

帧：uint32 little-endian 长度 + UTF-8 JSON。JSON 带 protocolVersion/sessionId/requestId/type/op/payload。requestId 使用字符串避免 JS 整数精度歧义。

- 初始单帧上限建议 1 MiB；翻译分块，整表设总量上限、哈希、commit/abort。
- 正确处理半包、粘包、无效长度、断连和待处理请求超时。
- read 可重试；写请求不盲目重发。写超时标记“结果未知”，先读回确认；需要重试时通过 requestId 去重。
- 文本采集批量发送、有界队列和丢弃计数；不允许阻塞游戏线程等待 UI 或网络。
- 不暴露任意地址读写、任意函数调用或加载 DLL 路径给渲染层；RPC 按操作与参数校验。
- 数据库和变量访问初期均经已验证的 game-thread queue；读取动态容器同样会遇到并发重分配。
- profile 尚未找到稳定调度点时，相关读写能力不开放。

## 8. Profile：固定样本开始，再扩展版本

profile 必须包含：
- profileId、状态（candidate/validated）、目标 Machine；
- 样本 EXE SHA-256、FileVersion、可选 .text 哈希；
- 每个功能的 pattern、mask、扫描模块/section、预期命中数；
- match→target 计算规则（偏移、rel32、解引用）；
- 指令/地址范围验证、调用约定、参数位置、对象布局；
- 编码、分配/赋值方法、线程调度点；
- 验证通过的能力、失败原因、来源与实测场景。

第一版按精确哈希选择 profile 后仍做地址和对象验证。未知哈希只进入诊断，不套用“最接近的版本”写内存。候选匹配多个时禁止自动启用；无命中不进行大范围猜偏移。

扩展顺序：同版本不同游戏 → 相邻版本 → 另一代构建。每个新样本记录自己的哈希和实际通过的功能，不能将一个成功样本推广为整个版本范围。设置 feature 级失败，不因数据库定位失败关闭已验证的文本捕获。

## 9. 首个样本静态基线

检查时间：2026-09-13；仅读取文件，未启动或修改游戏。

| 字段 | 结果 |
| --- | --- |
| 本地目录 | F:\BaiduNetdiskDownload\testgame |
| 启动文件 | Game.exe |
| 大小 | 6,963,200 bytes |
| PE Machine | 0x014C，x86 |
| FileVersion | Ver2.2961 |
| ProductVersion | 1, 0, 0, 0 |
| ProductName | WOLF RPG Editor |
| SHA-256 | 795203A6E875618D7FBDC7DD1F409A445C60262C911745553D040081BEDB6AC0 |
| 数据布局 | Data/BasicData.wolf、MapData.wolf 等封包 |
| 样本目录中的旧 EXE 备份 | 与当前 Game.exe 的 SHA-256 相同 |
| forceWolf3Start | 文本 true |
| wolfVersionFixTo | 字节 E5 00；具体配置含义未核验 |

FileVersion 是文件资源声明，不是已验证的内存 ABI；配置文件也不能证明游戏就是 Wolf 3。备用 EXE 与当前文件相同只能证明两者一致，不能证明是未经修改的原版。

建议样本 ID：wolf-x86-2.2961-795203a6，初始状态 candidate。后续原生验证使用独立测试副本，保留现有目录作为基线；不自动删除已有工具标记、替换 EXE 或复用未知翻译缓存。本地路径只用于开发测试，不写入产品打包或硬编码检测规则。

首个动态验收：无工具启动基线、CTool 启动握手、标题/读档/地图/对话/菜单采集、短长译文与控制符、停止替换、退出重启、日志能力报告。作弊在只读结构稳定后再验收数值写入及读回。

## 10. 公开资料调研

检索日期：2026-09-13。以下是机制参考，尚未在本样本验证；正式采用时记录所参考仓库的 commit 和文件哈希，避免 main/master 变化。

### LunaHook / LunaTranslator

[Wolf.cpp](https://github.com/HIllya51/LunaTranslator/blob/main/src/NativeImpl/LunaHook/LunaHook/engine32/Wolf.cpp) 包含多套字节扫描、调用点解析、文本获取和部分回嵌逻辑；可参考对象校验及不同编码路径。函数名 Wolf3/Wolf5 等不能作为引擎版本编号。源码注释也有早期版本与固定地址记录，但不构成现代版本兼容矩阵。

用途：为当前样本提出候选文本调用点，再在游戏自身代码中验证。不能直接把它的框架回调复制成独立 DLL。

### Textractor

[engine.cc 的 Wolf 部分](https://github.com/Artikash/Textractor/blob/master/texthook/engine/engine.cc) 给出基于 GetTextMetricsA 调用关系及 CharNextA 调用者的定位思路。InsertWolf2Hook 从对象偏移读取字符串，可作为字节匹配失败时的语义交叉验证。它主要说明文本提取，不证明数据库写入或译文回嵌。

### WolfDec

[WolfDec](https://github.com/Sinflower/WolfDec) 是资源封包解包方向的参考。它的归档版本/密钥信息与运行时 Hook 特征是不同问题，首期无需集成，也不能据此确定内存变量地址。

### Windows 架构约束

[Microsoft Process Interoperability](https://learn.microsoft.com/en-us/windows/win32/winprog64/process-interoperability) 说明进程内 DLL 的位数限制；[Detours helper 说明](https://github.com/microsoft/Detours/wiki/OverviewHelpers) 提供辅助进程处理架构差异的设计参考。

### 复用边界与尚缺证据

LunaTranslator 和 Textractor 仓库 LICENSE 展示 GPLv3 文本：
[LunaTranslator LICENSE](https://github.com/HIllya51/LunaTranslator/blob/main/LICENSE)、
[Textractor LICENSE](https://github.com/Artikash/Textractor/blob/master/LICENSE)。
CTool 当前采用 PolyForm Noncommercial；不能默认把第三方实现复制进来后继续只按现有许可证发布。实施阶段记录具体文件的许可与来源，根据游戏实测实现所需接口；引入外部代码前核对许可和署名要求。

本轮未找到可直接采用的“Wolf 各版本 → 完整作弊对象/翻译 ABI → 实测覆盖”公开矩阵。这不等于网上不存在；当前证据仍不足以跳过样本验证。候选特征、函数签名、控制分支和对象所有权均需通过目标游戏验证。

## 11. 文件落点与迁移顺序

以下均为计划新增或调整：

| 层 | 文件/目录 | 责任 |
| --- | --- | --- |
| 共享契约 | src/types/GameSession.ts、src/game/wolfTypes.ts | 会话、能力、Wolf 数据模型 |
| 主进程编排 | src/electron/services/gameSessionService.js | 活动会话、状态、清理 |
| 引擎驱动 | src/electron/engines/registry.js、mvmzDriver.js、wolfDriver.js | 系统级引擎分派 |
| Wolf 文件工具 | src/engine/wolf/detect.js、profiles.js | PE/版本/指纹、候选元信息 |
| Wolf 通信 | src/electron/wolf/protocol.js、pipeServer.js | 帧、验证、请求生命周期 |
| 桥接 | src/electron/preload.js、src/global.d.ts、ipc/registerIpcHandlers.js | 限定 API、类型同步 |
| Renderer | src/game/adapters/wolf.ts、registry.ts、useGameFeatures.ts | 会话绑定、操作/数据映射 |
| 页面 | src/ui/CheatMenu/wolfVariables/、wolfDatabases/、wolfStringVariables/ | 分页和类型化编辑 |
| 翻译页 | src/ui/CheatMenu/translateTool/ | 子能力控制、采集导出 |
| 原生 | native/injector/、native/wolf/、native/CMakeLists.txt | x86 helper、DLL、构建 |
| 原生 profile | native/wolf/profiles/ | 唯一 profile 定义及版本测试证据 |
| 测试 | tests/wolf/、tests/session/、native/tests/ | 协议/生命周期/结构和原生验证 |

profile 源定义只维护一份；构建时生成主进程识别元信息与 DLL 内数据，避免 profiles.js 和 C++ 各自维护偏移。原生 release 输出目录单独忽略，第三方库锁定版本；现有 .gitignore 忽略 *.sln/*.vcxproj，优先提交 CMake 源配置。

package.json 增加明确的 build:native 与测试命令后再使用，当前仓库没有这些命令。打包通过 extraResources 放置 native/wolf/x86 下的 EXE、DLL 和元信息；开发从 native 构建目录取资源，生产从 process.resourcesPath 取。原生二进制必须在 ASAR 外，打包前校验存在及架构，不复用被忽略的 tool_data 作为唯一构建来源。

## 12. 分阶段交付与验收

| 阶段 | 交付 | 完成条件 |
| --- | --- | --- |
| P0 架构准备 | 通用检测/driver/session、Adapter 契约兼容迁移 | MV/MZ 原有功能与退出清理通过；会话竞态和迟到响应测试通过 |
| P1 原生骨架 | x86 injector、空 DLL、pipe、实际 PID 退出通知 | 固定样本启动/关闭、中文路径、加载失败和断连可诊断 |
| P2 只读文本 | 单样本 profile、采集、导出 JSON、页面可见能力 | 多场景文本可重复采集；无效 profile 不安装 Hook |
| P3 运行时翻译 | 编码验证、翻译表切换、稳定回写 | 中日文、长文本、控制符、反复加载和关闭无崩溃 |
| P4 作弊 | 变量组/字符串/数据库先读后写，分页 UI | 结构及边界验证、正确线程执行、写后读回；保存读档行为记录 |
| P5 扩展版本 | 第二样本及更多 profile | 原样本全回归；新增能力逐项验证，不凭版本字符串扩大覆盖 |

实现后的验证：
- npm run build；AI/备份/注入相关变更执行现有对应测试。
- 新增协议测试验证半包/粘包/超限/断连/请求关联；会话测试验证 ready 提前到达、重复启动与旧会话回包。
- 原生测试验证 PE 解析、pattern 无命中/多命中、rel32 地址解析、对象边界；使用合成数据，不把游戏本体提交仓库。
- 分页与能力测试覆盖只读、翻译单能力、空能力、能力撤回、快速切换查询。
- 每次原生动态测试保存样本哈希、DLL 构建版本、profile、命中 RVA、场景及结果；“加载成功”不得计作“翻译/作弊通过”。
- Windows 打包产物测试资源路径和退出监视，不能只在 npm run dev 中验收。

开始编码前仍待样本验证的关键项：文本 Hook 的实际参数与调用约定、字符串编码和所有权、数据库根对象、稳定游戏线程调度点。它们决定各阶段能开放的能力，不阻塞先完成 P0/P1。
