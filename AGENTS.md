# CTool 项目上下文

本文件是 AI 编码代理和新贡献者的首要入口。先读这里，再按“任务定位”读取相关代码；不要为了理解项目而默认扫描整个仓库。

## 项目是什么

CTool 是一个仅面向 Windows 的 Electron 桌面工具，用于识别并启动 RPG Maker MV / MZ 游戏。它会以 RPG Maker 插件的方式临时注入本地脚本，让 React 界面通过 localhost 读取和修改运行中的游戏数据；同时提供文本提取、实时翻译、数据内嵌翻译、备份还原和 AI 批量翻译。

完整游戏功能目前支持 RPG Maker MV / MZ；Wolf 已实现 x86 识别、原生启动、DLL 双向通信、金币修改及基本系统已分配道具/武器/防具数量修改，启动不受哈希白名单限制。MY 金币双向修改已由用户验收；三项道具库存已通过只读探针对照用户报告。库存写入仅限已存在的数量行，尚不创建缺失记录；其他游戏布局仍待验证；尚无角色修改、文本采集或翻译 Hook。原始数据库浏览仅保留 DEV 入口。

Wolf 完整设计见 [适配方案](docs/WOLF_IMPLEMENTATION_PLAN.md)，实际落地范围、构建方式和样本测试记录见 [P0/P1 状态](docs/WOLF_P1_STATUS.md)。先区分已实现与后续计划。

理解现有 Wolf 实现优先读 [代码导读](docs/WOLF_CODE_WALKTHROUGH.md)：逐层解释启动注入、特征扫描、数据库指针链、业务映射、按焦点刷新、金币写入及现有库存写入范围。当前数据库访问是内存扫描读取，不是数据库函数 Hook。

技术栈：Electron 37、React 19、TypeScript 5、Vite 7、Ant Design 5。Electron 主进程与测试代码主要使用原生 ESM JavaScript，渲染层主要使用 TypeScript/TSX。

## 运行架构

项目有两条不要混淆的通信链路。

### 1. 桌面端与游戏启动链路

```text
React UI
  -> window.electronAPI（preload 暴露）
  -> Electron IPC handlers
  -> gameSessionService / engines registry
  -> MV/MZ 插件驱动，或 Wolf x86 injector + DLL
  -> 启动 Game.exe 并发布会话状态
```

- Electron 入口：`src/electron/main.js`
- 渲染层桥接：`src/electron/preload.js`
- IPC 注册：`src/electron/ipc/registerIpcHandlers.js`
- 游戏识别：`src/electron/services/gameDetectionService.js` -> `src/utils/gameUtil.js`
- 游戏会话：`src/electron/services/gameSessionService.js`（快照 + revision 事件）
- 主进程引擎驱动：`src/electron/engines/registry.js`、`mvmzDriver.js`、`wolfDriver.js`
- Wolf 检测和指纹：`src/engine/wolf/detect.js`
- Wolf 原生程序：`native/injector/main.cpp`、`native/wolf/main.cpp`
- MV/MZ 插件注入实现：`src/engine/mvmz/injectScript.js`、`src/engine/mvmz/pluginInjection.js`
- 注入脚本源文件：`inject/cheat.js`、`inject/translator.js`

MV/MZ 注入时，CTool 将两个脚本复制到游戏的 `js/plugins`，并把插件项加入 `js/plugins.js`。游戏进程退出后会清理本次添加的插件项和文件。异常退出可能来不及清理。

Wolf 使用 inject-x86.exe 创建并在 PE 入口点暂时暂停游戏，注入 DLL 后恢复运行。双向 Named Pipe 服务端在 injector 内，设置当前用户 ACL、拒绝远程连接并核对客户端 PID；请求经 helper stdin，响应经 stdout。GameEngineAdapter.database 提供会话绑定的目录/分页访问；native/wolf/database_reader.h 不解释业务字段，src/electron/wolf/databaseSemantics.js 和 goldMonitor.js 在 CTool 获得焦点时识别并刷新金币，再经 telemetry.gold 显示。DatabaseBrowser 允许只读查看及本会话金币绑定，没有开放完整修改器能力。布局、旧错误和验收范围见 [数据库与金币 MVP](docs/WOLF_GOLD_MVP.md)。

### 2. 运行时游戏数据链路

```text
MvmzCheatMenu 页面
  -> useGameFeatures（MV/MZ 状态与修改动作）
  -> registry 选择 MV/MZ adapter
  -> HTTP localhost:5000
  -> inject/cheat.js 中的游戏内服务

WolfCheatMenu 页面
  -> Wolf adapter 的 database / collections 接口
  -> 会话专用 IPC
  -> injector + DLL Named Pipe
```

- 统一数据结构：`src/game/features.ts`
- Adapter 契约、能力和快捷动作类型：`src/game/types.ts`
- 引擎注册：`src/game/registry.ts`
- MV/MZ Adapter：`src/game/adapters/mvmz.ts`
- 状态与操作编排：`src/game/useGameFeatures.ts`
- 向子页面提供单项数据：`src/game/GameFeatureContext.tsx`
- MV/MZ 功能页注册与能力过滤：`src/ui/CheatMenu/tabRegistry.tsx`
- 引擎 UI 分流：`src/ui/CheatMenu/index.tsx`；具体页面为 `MvmzCheatMenu.tsx`、`WolfCheatMenu.tsx`
- HTTP 封装：`src/lib/http.ts`

`localhost:5000` 是注入到游戏中的数据服务。`localhost:5001` 是 Electron 自己监听的回调服务，游戏加载完成后向 `/gameReady` 发消息，由主进程转为会话 ready 状态。不要交换这两个端口的职责。

## 主要目录

2026-09-14 库存展示规则更新：已注册定义为主表，成功读取且映射明确的背包按 ID 覆盖数量；缺少持有记录显示 0，读取失败/未确认映射保持不可用。显示 0 不会创建游戏记录，也不代表存在可写地址。MV/MZ 使用 `InventoryTable`；Wolf 使用独立 `WolfInventoryTable` 与动态 collections 编排，仅复用搜索、滚动和草稿值等无业务语义的基础组件。

Wolf 物品分类由映射结果生成独立标签页，每分类完整虚拟滚动表，无 UI 分页。DLL 已连通但运行时数据库尚未构造时，Wolf 启动遮罩会以短间隔重试目录读取，分类成功后才解除；正常使用阶段不后台轮询，仅在焦点、手动刷新或写入后更新活动分类。底层仍按 10 行分批读取，库存边界查询运行时行数，不以初始缓存行数跳过后续数据。读取失败与未确认映射不能按零库存处理。

Wolf 普通 UI 展示金币控制台和物品资料；原始数据库、手动金币候选和详细诊断只在 DEV 可见。Wolf adapter 独有 collections 接口通过 databaseMapping.js 和 wolfCollections.ts 解释可选基本系统语义，不向 MV/MZ 添加虚假能力。映射规则、MY 三项库存核验及多游戏扩展边界见 [Wolf 映射](docs/WOLF_MAPPING.md)。金币双向修改已由用户验收；当前确认映射的现有库存行可修改。库存 UI 已改传 collectionKey + itemId，wolfDriver 写前重读目录并解析 quantityBinding；DLL writeNumber 执行既有数字记录写入。新增表内数量字段规则只有合成测试，尚未经真实游戏验证。当前未实现缺失记录创建，不能宣称已支持所有注册物品；不同游戏的数量映射和记录初始化流程仍需验证。

UI 在 `CheatMenu/index.tsx` 按引擎分流：`MvmzCheatMenu` 只维护 MV/MZ 页签、原有加载遮罩与功能刷新，`WolfCheatMenu` 只维护 DLL 初始化遮罩、动态库存和 DEV 数据库页。Wolf 的首个“基础功能”页由 `WolfBaseFeaturesPage` 承载，当前只有经验证的金币能力，后续速度、战斗或角色能力也在这里增加；`WolfGoldReadout/WolfGoldEditor` 只是该页内部的金币控件。MV/MZ 主页保留自己的紧凑金币输入框和失焦提交行为。setGameGold 经会话专用 IPC 调用，需 goldWriteProtocol=1；只允许当前绑定的可变数据库数字字段并核对旧值、回读确认。数据库浏览 IPC 不允许写入。原生后台单值写入不是主线程事务，不在读档/切场景期间使用；不要把未知背包布局直接套用 MV/MZ。

```text
src/ui/                 React 页面；Main 负责选游戏，CheatMenu 负责运行时功能
src/game/               与引擎无关的统一游戏数据层和 MV/MZ Adapter
src/electron/           Electron 主进程、IPC、窗口与桌面端业务服务
src/electron/ai/        AI 翻译请求、分批、重试、并发与断点工作文件
src/engine/mvmz/        MV/MZ 文件处理、插件注入和文本提取
src/engine/wolf/        Wolf 文件检测、PE 与诊断指纹（不限制启动）
native/                x86 injector、最小 DLL、CMake 构建和测试夹具
scripts/               原生构建与端到端烟测
src/lib/                渲染层通用基础设施，目前主要是 HTTP
src/utils/              游戏识别、历史记录等旧式工具代码
inject/                 会复制进目标游戏的运行时插件脚本
tests/                  Node test：AI 翻译、备份还原、插件注入
docs/                   设计计划和 UI 规范；计划文档不等于已完成实现
tool_data/              打包时随应用分发的工具数据
```

构建产物 `dist/`、`dist-electron/`、`dist-react/` 以及依赖目录 `node_modules/` 不应作为理解或修改源码的入口。

## 按任务定位

| 任务 | 优先读取 |
| --- | --- |
| 修改启动页、历史页或顶层导航 | `src/ui/Main/index.tsx`，再读对应 `src/ui/*` 页面 |
| 增改 MV/MZ 修改器页面 | `src/ui/CheatMenu/MvmzCheatMenu.tsx`、`tabRegistry.tsx`、目标页面、`src/game/features.ts`、`src/game/useGameFeatures.ts` |
| 增改 Wolf 修改器页面 | `src/ui/CheatMenu/WolfCheatMenu.tsx`、`CollectionBrowser.tsx`、`WolfInventoryTable.tsx`、Wolf adapter 与会话 IPC |
| 新增游戏数据能力或接口 | 上述文件，再读 `src/game/types.ts`、`src/game/adapters/mvmz.ts`、`inject/cheat.js` |
| 支持新游戏引擎 | `src/game/types.ts`、`src/game/registry.ts`、新 Adapter、检测/注入服务；不要把 MV/MZ 分支散落进 UI |
| 修改游戏选择、文件操作或系统能力 | `src/electron/preload.js`、`src/global.d.ts`、`src/electron/ipc/registerIpcHandlers.js`、对应 service |
| 修改注入与退出清理 | `src/electron/services/gameSessionService.js`、`src/electron/engines/*`、`src/engine/mvmz/*`、`tests/injection/*`、`tests/wolf/*` |
| 修改文本提取或内嵌翻译 | `src/electron/services/translationService.js`、`translationEngineAdapters.js`、`gameDataBackupService.js`、`src/engine/mvmz/extract.js` |
| 修改 AI 批量翻译 | `src/ui/AITranslation/*`、`src/electron/ai/*`、`src/types/AITranslation.ts`、`tests/ai/*` |
| 修改全局快捷键 | `src/game/shortcut*`、`src/electron/services/globalShortcutService.js`、`src/ui/CheatMenu/shortcuts/*` |
| 修改开发假游戏预览 | `src/dev/*`、`src/ui/App.tsx` |
| 修改打包内容 | `package.json` 的 `build`、`vite.config.ts`、`src/electron/services/appResourceService.js` |

## 必须保持的设计约束

- UI 使用 `GameEngineAdapter` 和统一字段，不直接依赖 MV/MZ 原始数据结构。引擎差异留在 adapter、检测、注入或翻译 adapter 中。
- 新增 preload API 时，同步修改 `src/electron/preload.js`、`src/global.d.ts` 和 IPC handler；敏感文件与进程能力不能直接暴露给渲染层。
- MV 的常见目录是 `www/js`、`www/data`；MZ 是 `js`、`data`。涉及路径时必须同时检查两种布局。
- 注入必须保留游戏原有 `$plugins` 配置，并保持重复执行幂等；退出清理只能移除 CTool 自己的插件。
- 数据内嵌翻译会修改目标游戏文件。保留“先备份、校验备份属于当前游戏、失败可回退”的安全边界。
- API Key 只在当前运行期间使用，不得写入配置、日志或翻译工作文件，也不得在错误信息中回显。
- `inject/` 和 `tool_data/` 是打包资源。修改文件名或位置时同步检查 `package.json` 的 `build.extraResources`。
- `docs/*_PLAN.md` 记录规划和历史决策。判断当前行为时，以代码和测试为准。
- Wolf 启动不受 EXE 哈希白名单限制；禁止因版本相似就启用未验证 Hook。进程/DLL 位数必须匹配。
- 游戏 ready/closed 使用会话快照和 revision，不能恢复旧的无会话布尔事件。DLL 失联不能冒充游戏退出。
- 不直接编辑构建产物；改 `src/` 或 `inject/` 中的源文件后重新构建。

## 常用命令

```powershell
npm run dev
npm run build
npm run lint
npm run test:ai
npm run test:backup
npm run test:injection
npm run build:native
npm run test:wolf
npm run test:native
npm run dist
```

`build:native` 需要 Windows Visual Studio C++ x86 工具和 CMake。`test:native` 会启动并正常关闭自建测试窗口；指定实际游戏的方法见 P0/P1 状态文档。原生输出 `native/build/` 不提交。

验证应与改动范围匹配：UI 或类型变更至少运行 `npm run build`；注入、备份或 AI 逻辑还应运行对应测试。`npm run lint` 当前扫描整个仓库，遇到既有问题时要区分本次引入与历史问题。

## 修改文档时

- README 面向第一次访问项目的人：保持短、稳定、可快速运行，不放详细内部架构。
- 本文件面向 AI 和开发者：架构、入口、约束或命令变化时同步更新。
- 专项方案、迁移过程和较长设计讨论放在 `docs/`，并明确标注“计划中”还是“已实现”。
