# CTool 项目上下文

本文件是 AI 编码代理和新贡献者的首要入口。先读这里，再按“任务定位”读取相关代码；不要为了理解项目而默认扫描整个仓库。

## 项目是什么

CTool 是一个仅面向 Windows 的 Electron 桌面工具，用于识别并启动 RPG Maker MV / MZ 游戏。它会以 RPG Maker 插件的方式临时注入本地脚本，让 React 界面通过 localhost 读取和修改运行中的游戏数据；同时提供文本提取、实时翻译、数据内嵌翻译、备份还原和 AI 批量翻译。

当前只实际支持 RPG Maker MV / MZ。`wolf` 只存在于部分类型或规划中，不代表已实现。

技术栈：Electron 37、React 19、TypeScript 5、Vite 7、Ant Design 5。Electron 主进程与测试代码主要使用原生 ESM JavaScript，渲染层主要使用 TypeScript/TSX。

## 运行架构

项目有两条不要混淆的通信链路。

### 1. 桌面端与游戏启动链路

```text
React UI
  -> window.electronAPI（preload 暴露）
  -> Electron IPC handlers
  -> services / engine 文件操作
  -> 注入插件并启动 Game.exe
```

- Electron 入口：`src/electron/main.js`
- 渲染层桥接：`src/electron/preload.js`
- IPC 注册：`src/electron/ipc/registerIpcHandlers.js`
- 游戏识别：`src/electron/services/gameDetectionService.js` -> `src/utils/gameUtil.js`
- 注入和进程生命周期：`src/electron/services/gameInjectionService.js`
- MV/MZ 插件注入实现：`src/engine/mvmz/injectScript.js`、`src/engine/mvmz/pluginInjection.js`
- 注入脚本源文件：`inject/cheat.js`、`inject/translator.js`

注入时，CTool 将两个脚本复制到游戏的 `js/plugins`，并把插件项加入 `js/plugins.js`。游戏进程退出后会清理本次添加的插件项和文件。异常退出可能来不及清理。

### 2. 运行时游戏数据链路

```text
CheatMenu 页面
  -> useGameFeatures（统一状态与修改动作）
  -> registry 选择 GameEngineAdapter
  -> MV/MZ adapter
  -> HTTP localhost:5000
  -> inject/cheat.js 中的游戏内服务
```

- 统一数据结构：`src/game/features.ts`
- Adapter 契约、能力和快捷动作类型：`src/game/types.ts`
- 引擎注册：`src/game/registry.ts`
- MV/MZ Adapter：`src/game/adapters/mvmz.ts`
- 状态与操作编排：`src/game/useGameFeatures.ts`
- 向子页面提供单项数据：`src/game/GameFeatureContext.tsx`
- 功能页注册与能力过滤：`src/ui/CheatMenu/tabRegistry.tsx`
- HTTP 封装：`src/lib/http.ts`

`localhost:5000` 是注入到游戏中的数据服务。`localhost:5001` 是 Electron 自己监听的回调服务，游戏加载完成后向 `/gameReady` 发消息。不要交换这两个端口的职责。

## 主要目录

```text
src/ui/                 React 页面；Main 负责选游戏，CheatMenu 负责运行时功能
src/game/               与引擎无关的统一游戏数据层和 MV/MZ Adapter
src/electron/           Electron 主进程、IPC、窗口与桌面端业务服务
src/electron/ai/        AI 翻译请求、分批、重试、并发与断点工作文件
src/engine/mvmz/        MV/MZ 文件处理、插件注入和文本提取
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
| 增改修改器页面 | `src/ui/CheatMenu/tabRegistry.tsx`、目标页面、`src/game/features.ts`、`src/game/useGameFeatures.ts` |
| 新增游戏数据能力或接口 | 上述文件，再读 `src/game/types.ts`、`src/game/adapters/mvmz.ts`、`inject/cheat.js` |
| 支持新游戏引擎 | `src/game/types.ts`、`src/game/registry.ts`、新 Adapter、检测/注入服务；不要把 MV/MZ 分支散落进 UI |
| 修改游戏选择、文件操作或系统能力 | `src/electron/preload.js`、`src/global.d.ts`、`src/electron/ipc/registerIpcHandlers.js`、对应 service |
| 修改注入与退出清理 | `src/electron/services/gameInjectionService.js`、`src/engine/mvmz/*`、`tests/injection/*` |
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
- 不直接编辑构建产物；改 `src/` 或 `inject/` 中的源文件后重新构建。

## 常用命令

```powershell
npm run dev
npm run build
npm run lint
npm run test:ai
npm run test:backup
npm run test:injection
npm run dist
```

验证应与改动范围匹配：UI 或类型变更至少运行 `npm run build`；注入、备份或 AI 逻辑还应运行对应测试。`npm run lint` 当前扫描整个仓库，遇到既有问题时要区分本次引入与历史问题。

## 修改文档时

- README 面向第一次访问项目的人：保持短、稳定、可快速运行，不放详细内部架构。
- 本文件面向 AI 和开发者：架构、入口、约束或命令变化时同步更新。
- 专项方案、迁移过程和较长设计讨论放在 `docs/`，并明确标注“计划中”还是“已实现”。
