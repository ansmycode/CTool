# CTool 项目上下文

本文件是 AI 编码代理和新贡献者的首要入口。先读这里，再按“任务定位”读取相关代码；不要为了理解项目而默认扫描整个仓库。

`docs/` 为本地参考文档目录，已从版本历史移除并加入 Git 忽略规则；新克隆不包含这些文件。下文的 `docs/` 链接仅在本地文档存在时可用；缺失时以源码、测试和本文件为准，不要求下载私人研究记录。

## 项目知识库：按需读取与同步

本机知识库：`D:\obsidian_storehouse\ctool`。导航入口为 `CTool 首页.md` 和 `03 开发指南/代码入口与任务定位.md`；这两个文件是导航，不要求每次任务都重复读取。其他机器没有该路径时，使用本文件、源码和测试继续工作，并在需要知识库时说明不可用。

### 开发前定向读取

- 先按本文件的任务定位选择代码入口，再根据下表读取影响当前决策的笔记或相关章节。任务明确时直接读取目标笔记，不默认遍历知识库，不默认读取 `99 历史归档/`。
- 索引未覆盖时，先用 `rg --files` 查标题或在相关目录用 `rg -n` 搜索关键词，再读取匹配内容；Obsidian 双向链接用于定位文件，不代表应递归读取全部链接。
- 修改 Wolf 翻译前，必须读取翻译架构、Wolf 翻译计划、已知问题和待验收事项中的相关内容，保留当前技术问题与验收边界。
- 文档与源码不一致时，根据当前源码、测试和用户最新确认判断，同时修正受影响的文档；历史方案不能作为已实现或已验收证据。

| 任务 | 知识库优先入口（相对于知识库根目录） |
| --- | --- |
| 游戏启动、退出与注入 | `02 项目架构/游戏启动与会话.md`、`03 开发指南/开发约束与注意事项.md` |
| MV/MZ 运行时功能或页面 | `02 项目架构/MV-MZ 运行时链路.md`、`03 开发指南/开发约束与注意事项.md` |
| Wolf 金币、库存、变量、变速与穿墙 | `02 项目架构/Wolf 运行时链路.md`、`05 问题与验收记录/待验收事项.md` |
| 文本提取、运行时翻译与内嵌 | `02 项目架构/翻译架构.md`；Wolf 另读 `04 专项设计/Wolf 翻译计划.md` 和 `05 问题与验收记录/` 中的相关事项 |
| AI 翻译任务 | `02 项目架构/翻译架构.md` 的 AI 任务部分、`03 开发指南/测试与验收.md` |
| 打包、资源位置与构建 | `03 开发指南/环境与构建.md`、`03 开发指南/开发约束与注意事项.md` |
| 新引擎或跨模块架构调整 | `02 项目架构/总体架构.md`、`01 项目说明/功能与兼容范围.md`、相关链路笔记 |

### 较大改动后的同步

新增功能、跨模块重构、接口或协议变化、缓存与备份规则变化、兼容范围变化，以及重要问题修复后，在结束任务前直接更新受影响的知识库主题笔记；纯排版或局部无行为变化的改动无需同步。

- 定向修改相关笔记，不全量重新生成；保留人工补充内容。记录实际行为、关键入口、必要的设计理由、实际验证结果和剩余限制，明确区分已实现、测试通过、用户验收和计划中。
- 更新日期与来源版本。未提交改动注明“工作区未提交”，同时保留基线 commit，不把 HEAD 冒充本次改动版本；后续提交时更新受影响笔记的版本标记。
- 新增、改名或移动笔记时同步首页／任务索引及相关双向链接。禁止覆盖历史归档、`.obsidian/` 配置或无关笔记，不默认新增全量归档。
- 关键开发约束、源码入口和命令变化时，同步本文件及相关模块 README，确保没有本机知识库也能开发。知识库读取失败可继续独立工作；同步缺少写权限或失败时说明具体限制，不宣称同步成功。
- 任务最终回复列出更新的笔记，或说明无需同步的原因／未能同步的限制。任务内同步规则不创建后台自动同步，也不自动授权 Git 提交或推送。

## 项目是什么

CTool 是一个仅面向 Windows 的 Electron 桌面工具，用于识别并启动 RPG Maker MV / MZ 游戏。它会以 RPG Maker 插件的方式临时注入本地脚本，让 React 界面通过 localhost 读取和修改运行中的游戏数据；同时提供文本提取、实时翻译、数据内嵌翻译、备份还原和 AI 批量翻译。

完整游戏功能目前支持 RPG Maker MV / MZ；Wolf 已实现 x86 识别、原生启动、DLL 双向通信、金币修改及基本系统已分配道具/武器/防具数量修改，启动不受哈希白名单限制。MY 金币双向修改已由用户验收；三项道具库存已通过只读探针对照用户报告。库存写入仅限已存在的数量行，尚不创建缺失记录；其他游戏布局仍待验证；尚无角色修改；文本提取和首版翻译 Hook 已落地，Hook 真实显示效果待用户验收。原始数据库浏览仅保留 DEV 入口。

Wolf 完整设计见 [适配方案](docs/WOLF_IMPLEMENTATION_PLAN.md)，实际落地范围、构建方式和样本测试记录见 [P0/P1 状态](docs/WOLF_P1_STATUS.md)。先区分已实现与后续计划。

理解现有 Wolf 实现优先读 [代码导读](docs/WOLF_CODE_WALKTHROUGH.md)：逐层解释启动注入、特征扫描、数据库指针链、业务映射、按焦点刷新、金币写入及现有库存写入范围。当前数据库访问是内存扫描读取，不是数据库函数 Hook。

2026-09-19 新增数值变量查看/修改、0.25–4 倍变速和穿墙开关，用户已确认三项功能在其测试游戏中正常（不代表全部版本兼容）。入口为 `GameEngineAdapter.runtime` → `game:wolf-runtime` → `native/wolf/runtime_control.h`。变量按组/ID 读写，`wolfVariables.ts` 将运行值与系统库 `14 + group` 名称表按 ID 联查，按会话缓存目录、焦点刷新重建，结构不符显式降级；Wolf 金币、库存、变量与速度统一使用 `BlurNumberInput` 失焦提交，保留编辑旧值，清空或未改值不写入；变速与穿墙使用 MinHook，数据库读取方式不变。实现证据、限制和验收步骤见 [运行时功能](docs/WOLF_RUNTIME_FEATURES.md)。

技术栈：Electron 37、React 19、TypeScript 5、Vite 7、Ant Design 5。Electron 主进程与测试代码主要使用原生 ESM JavaScript，渲染层主要使用 TypeScript/TSX。

CheatMenu 固定窗口尺寸且页面不允许整体滚动，功能块与主要操作必须在可视范围内。AI 翻译页面通过弹窗提供高级配置：并发请求数、每批条目数/字符上限、请求间隔、超时及重试次数。默认值与校验集中在 `src/shared/aiTranslationSettings.js`，随应用打包；配置经现有 startAITranslation IPC 传入 `config.execution`，仅在当前页面保留。`src/electron/ai/translator.js` 使用并发任务池和全局请求间隔，失败后停止新请求，等待在途批次保存后才结束任务；工作文件不保存 API Key 或执行配置。

2026-10-08 AI 配置更新：默认每批 100 条、并发 3、字符上限 20000。服务商与模型预设、协议和 URL 校验集中在 `src/shared/aiProviders.js`，UI 与主进程共用；支持 OpenAI Chat Completions、OpenAI Responses、Anthropic Messages。自定义配置显式选择协议，JSON 格式参数可关闭，译文仍须通过逐项 JSON 校验。只有自定义回环地址允许空 Key／HTTP，远程地址需 HTTPS 与 Key；URL 禁止含凭据。官方专用推理参数仅对对应官方域名生效，中转站使用通用协议参数。请求为非流式，速度仍取决于模型。Sakura 等本地模型仅实现协议接入，尚未实机验收。详细说明见知识库 `04 专项设计/AI 翻译协议与本地模型.md`。

## 运行架构

2026-10-09 Wolf 启动字体：`src/ui/Main/index.tsx` 在识别支持的游戏后提供“原游戏字体／Noto Sans CJK SC”选择，历史启动先回到该页；仅启动前可选，CheatMenu 不提供字体修改。`game:launch` 携带 `launchOptions.fontId`，`gameSessionService` 验证只允许内置 ID，MV/MZ 通过 inject/font.js 加载同一字体；按实际 www/js 或 js 布局临时复制到 fonts/.ctool-*，保留游戏原字体，正常退出清理本次资源。MV 使用 Graphics.loadFont，MZ 使用 FontManager.load；Scene_Boot 等待字体，窗口和 Bitmap 测量/绘制统一使用工具字体。字体插件未提供运行时修改接口。`src/electron/wolf/launchFont.js` 校验资源 SHA-256，`wolfDriver` 传给 injector 可选第五参数；DLL 在游戏入口点恢复前完成 FR_PRIVATE 加载、物理字体验证和 GDI 创建 API Hook，经成功/失败事件门控启动。`native/wolf/font_override.h` 覆盖动态解析的 CreateFontA/W 及 indirect/ex 入口，仅替换游戏主程序调用的字体名，保留度量/样式/字符集，跳过 SYMBOL 图标字体与外部 DLL 调用。字体持续至游戏退出，断连不恢复，未暴露运行时修改协议。原始字体及 OFL 许可证在 `tool_data/fonts/` 随包分发，该目录加入版本管理，其他 tool_data 仍忽略。字体不能解决 Shift-JIS 编码、图片文字、过长译文或固定文本框；真实游戏布局待验收。原生字体测试由 `test:native:unit` 执行，启动烟测可加 `--font`，详见 native/README.md 与知识库字体方案。

2026-10-08 状态：Wolf 翻译当前为阶段性实现，用户确认基础翻译仍有技术问题，功能尚不完善，后续再解决。离线／自建测试通过不代表真实游戏翻译效果已验收；不得宣称 Wolf 翻译已完整可用。

AI 任务由主进程按源 JSON 路径互斥管理，页面刷新不代表任务结束。`ai-translation:task-status` 返回任务状态和已落盘进度；翻译页面选择文件后定时同步，并提供 `ai-translation:stop`。停止使用 AbortSignal 中断请求、响应读取、节流和重试等待，等待工作线程收束后释放锁；写入前检查取消信号，迟到响应不能覆盖续译结果。断点续译保留已完成项，仅处理未翻译／错误项；不得靠直接清锁并发启动第二份任务。

Wolf 独立翻译页 `src/ui/CheatMenu/wolf/translation/WolfTranslationPage.tsx` 已接入文件文本提取和通用 JSON AI 翻译。入口 `adapter.textTranslation` → `game:wolf-text-extract` → `wolfTextService.js` → `src/engine/wolf/text/cache.js` → Worker 线程中的 JS `fileParser.js`（参考 WolfTL 格式读取逻辑，保留许可证；无需原生构建）。扫描 Data 中 MPS／DAT；数据库依赖同名 project。首次临时目录内完成解析、导出后改名为 `.ctool-cache/wolf-text`，同时保留 `parsed/` 可读文本结构、来源索引和 `CatToolTranslate.json`。再次提取只读缓存并重写纯净 JSON，不检测原文件变化；用户删除缓存后才重建。未知 DAT 明确列出，已识别文件解析失败不生成正式缓存。不支持资源包解包、Pro／加密输入。语义筛选在 `extractText.js`，当前收对白／选项、122/SetString 字符串赋值（含自定义对话公共事件的输入，排除明显资源路径）、名称说明类数据库字符串、用語設定表、角色名/称号、210 公共事件的字符串实参（排除目标名和明显资源路径）、150 文字图片的文本参数、标题等，按下文规则去除控制符后导出。JS 合成文件检查和 Nemoriar 样本离线提取对照通过，游戏端到端仍由用户验收。译文加载已接入首版 DLL Hook，内嵌仍禁用。加载选择纯净译文 JSON，经会话 IPC → wolfDriver → 分批十六进制长度帧 → DLL 暂存字典，完成后原子切换。卸载和断连清空字典，原文在对象下一次绘制时恢复；不后台解引用旧对象指针。不设独立 Hook 按钮。Hook 入口 `native/wolf/text_hook.h`，字典 `text_dictionary.h`、编码/清洗 `text_format.h`、运行时分段匹配 `text_matcher.h`；只启用通过 draw/reset/assign 联合特征验证的 x86 布局。Nemoriar 已做静态定位和自建 ABI/替换测试，真实显示效果仍待用户验收。UTF-8 支持中文；Shift-JIS 无法表示的译文拒绝加载，启动字体替换已接入，真实游戏字体显示效果待验收；文件写回尚未实现。

Wolf 纯净 JSON 按真实 LF／CRLF／CR 换行拆分，再复用 MV/MZ 控制符正则（公共模块 `src/engine/text/cleanText.js`），去除控制符／标签和行首尾空白，过滤空／无效条目并按清洗后显示文本去重。key/value 都不能保留控制符。DLL Hook 在内部绘制入口取得文本；普通 x86 布局的文本已可能包含 01 开头的二进制控制包。先按字节分离控制包，再解码可见文本查纯净字典，避免把参数当作 UTF-8 或换行。命中时仅替换文本片段，原始控制包、字面控制符、换行和首尾空白保留。句中控制符两侧分别精确匹配；只有整句译文而缺少片段译文时不猜测控制符在译文中的位置，未命中片段保留。对象被游戏重置后会重新应用译文，稳定帧不重置绘制进度。用户报告旧版仅标题三个按钮命中；上述修复已通过自建回归和样本静态定位，真实覆盖率及动态变量展开仍待用户验证。parsed 仅为追溯保留完整原文；`text-locations.json` 的行号及 UTF-16 start/end（end 不含）定位原始行，不是纯净文本的直接回填范围。修改筛选后直接从已有缓存重新导出。

项目有两条不要混淆的通信链路。

Wolf 文本提取缓存约定（已落地）：只读取普通 Wolf 游戏目录中已有的独立 `.mps/.dat` 等数据文件，不提供资源包解包或封装游戏还原，暂不兼容 Wolf Pro。先确认文件格式，按需处理文件内部解密/解压，再解析成可读中间 JSON。正式缓存使用游戏目录下 `.ctool-cache/wolf-text/`；首次转换先写独立临时目录，全部成功后才改名为正式缓存目录，失败或中断留下的临时目录不得作为缓存读取。后续只判断正式目录存在就直接读取中间数据，无需额外完成标记。不检测源文件变动、不自动重建已有正式缓存；页面常驻小提示，重新解析由用户手动删除正式缓存后再次提取。筛选结果输出为纯净 JSON。

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
- MV/MZ 功能页注册与能力过滤：`src/ui/CheatMenu/mvmz/tabRegistry.tsx`
- 引擎 UI 分流：`src/ui/CheatMenu/index.tsx`；具体页面为 `MvmzCheatMenu.tsx`、`WolfCheatMenu.tsx`
- HTTP 封装：`src/lib/http.ts`

`localhost:5000` 是注入到游戏中的数据服务。`localhost:5001` 是 Electron 自己监听的回调服务，游戏加载完成后向 `/gameReady` 发消息，由主进程转为会话 ready 状态。不要交换这两个端口的职责。

## 主要目录

Wolf 翻译范围见本地 [翻译计划书](docs/WOLF_TRANSLATION_PLAN.md)。整个工具的翻译层脑图与节点扩展入口见 [翻译层脑图](docs/TRANSLATION_ARCHITECTURE.md)。解析缓存不是完整工程；AI 工作文件和译文默认与输入 JSON 同目录，删除缓存前可先另存译文。

修改器界面按 `src/ui/CheatMenu/mvmz/`、`wolf/`、`shared/` 分类；根目录仅保留引擎分流与公共布局。MV/MZ 页面在 `mvmz/pages/`，Wolf 分为 `base/`、`inventory/`、`variables/`，无引擎语义的组件与 Hook 放 `shared/`。完整导航见 [CheatMenu 目录说明](src/ui/CheatMenu/README.md)。

2026-09-14 库存展示规则更新：已注册定义为主表，成功读取且映射明确的背包按 ID 覆盖数量；缺少持有记录显示 0，读取失败/未确认映射保持不可用。显示 0 不会创建游戏记录，也不代表存在可写地址。MV/MZ 使用 `InventoryTable`；Wolf 使用独立 `WolfInventoryTable` 与动态 collections 编排，仅复用搜索、滚动和草稿值等无业务语义的基础组件。

Wolf 物品分类由映射结果生成独立标签页，每分类完整虚拟滚动表，无 UI 分页。DLL 已连通但运行时数据库尚未构造时，Wolf 启动遮罩会以短间隔重试目录读取，分类成功后才解除；正常使用阶段不后台轮询，仅在焦点、手动刷新或写入后更新活动分类。底层仍按 10 行分批读取，库存边界查询运行时行数，不以初始缓存行数跳过后续数据。读取失败与未确认映射不能按零库存处理。

Wolf 普通 UI 展示金币控制台和物品资料；原始数据库、手动金币候选和详细诊断只在 DEV 可见。Wolf adapter 独有 collections 接口通过 databaseMapping.js 和 wolfCollections.ts 解释可选基本系统语义，不向 MV/MZ 添加虚假能力。映射规则、MY 三项库存核验及多游戏扩展边界见 [Wolf 映射](docs/WOLF_MAPPING.md)。金币双向修改已由用户验收；当前确认映射的现有库存行可修改。库存 UI 已改传 collectionKey + itemId，wolfDriver 写前重读目录并解析 quantityBinding；DLL writeNumber 执行既有数字记录写入。新增表内数量字段规则只有合成测试，尚未经真实游戏验证。当前未实现缺失记录创建，不能宣称已支持所有注册物品；不同游戏的数量映射和记录初始化流程仍需验证。

UI 在 `CheatMenu/index.tsx` 按引擎分流：`MvmzCheatMenu` 只维护 MV/MZ 页签、原有加载遮罩与功能刷新，`WolfCheatMenu` 维护 DLL 初始化、动态库存、数值变量和 DEV 数据库页。Wolf 的首个“基础功能”页由 `WolfBaseFeaturesPage` 承载，包含金币和独立的变速/穿墙控件；新运行时协议就绪后，基础功能与变量不被物品初始化遮罩阻挡。`WolfGoldReadout/WolfGoldEditor` 只是该页内部的金币控件。MV/MZ 主页保留自己的紧凑金币输入框和失焦提交行为。setGameGold 经会话专用 IPC 调用，需 goldWriteProtocol=1；只允许当前绑定的可变数据库数字字段并核对旧值、回读确认。数据库浏览 IPC 不允许写入。原生后台单值写入不是主线程事务，不在读档/切场景期间使用；不要把未知背包布局直接套用 MV/MZ。

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
| 增改 MV/MZ 修改器页面 | `src/ui/CheatMenu/mvmz/MvmzCheatMenu.tsx`、`tabRegistry.tsx`、目标页面、`src/game/features.ts`、`src/game/useGameFeatures.ts` |
| 增改 Wolf 修改器页面 | `src/ui/CheatMenu/wolf/WolfCheatMenu.tsx`、`CollectionBrowser.tsx`、`WolfInventoryTable.tsx`、Wolf adapter 与会话 IPC |
| 新增游戏数据能力或接口 | 上述文件，再读 `src/game/types.ts`、`src/game/adapters/mvmz.ts`、`inject/cheat.js` |
| 支持新游戏引擎 | `src/game/types.ts`、`src/game/registry.ts`、新 Adapter、检测/注入服务；不要把 MV/MZ 分支散落进 UI |
| 修改游戏选择、文件操作或系统能力 | `src/electron/preload.js`、`src/global.d.ts`、`src/electron/ipc/registerIpcHandlers.js`、对应 service |
| 修改注入与退出清理 | `src/electron/services/gameSessionService.js`、`src/electron/engines/*`、`src/engine/mvmz/*`、`tests/injection/*`、`tests/wolf/*` |
| 修改文本提取或内嵌翻译 | `src/electron/services/translationService.js`、`translationEngineAdapters.js`、`gameDataBackupService.js`、`src/engine/mvmz/extract.js` |
| 修改 Wolf 运行时翻译 | `native/wolf/text_hook.h`、`text_dictionary.h`、`src/electron/wolf/translationDictionary.js`、`textProtocol.js`、`wolfDriver.js`、`tests/wolf/textTranslation.test.js`、`native/tests/text_test.cpp` |
| 修改 Wolf 文件提取 | `src/electron/services/wolfTextService.js`、`src/engine/wolf/text/*`、`tests/wolf/text*.test.js` |
| 修改 AI 批量翻译 | `src/ui/AITranslation/*`、`src/electron/ai/*`、`src/types/AITranslation.ts`、`tests/ai/*` |
| 修改全局快捷键 | `src/game/shortcut*`、`src/game/adapters/wolf.ts`、`src/electron/services/globalShortcutService.js`、`src/ui/CheatMenu/shared/shortcuts/*` |
| 修改开发假游戏预览 | `src/dev/*`、`src/ui/App.tsx` |
| 修改打包内容 | `package.json` 的 `build`、`vite.config.ts`、`src/electron/services/appResourceService.js` |

## 必须保持的设计约束

2026-10-08 快捷键更新：MV/MZ 与 Wolf 共用 `shared/shortcuts` 配置页及 `useGameShortcuts` 注册／注销逻辑，仅允许动作目录中的触发类、开关类功能；数值输入不注册快捷键。MV/MZ 保留原 localStorage 配置键，Wolf 使用独立 `:wolf` 后缀。Wolf 当前仅有 `toggleThrough`，经 adapter 的 `executeShortcutAction` 读取当前运行时状态、验证能力后切换穿墙；不伪造 MV/MZ overview。未就绪、断连和退出时注销，关闭总开关保留绑定；同一动作执行中不接受重叠触发。快捷键成功后刷新活动基础页状态。未来触发动作必须先在对应引擎实现，再加入动作目录。

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

### 参考项目与自主实现

- 参考项目只用于理解文件格式、协议、行为和算法思路。先整理必要的格式事实与输入／输出要求，再按 CTool 的架构独立实现；不得直接复制源码文件、代码片段或类／函数实现，也不得通过改名、调整排版、翻译为另一种语言等方式照搬。
- 不得因参考项目而引入其工程结构、辅助代码、无关功能或新的维护依赖。格式常量、字段顺序等必要事实应通过样本和测试验证，不能把照搬上游读取流程当作自主实现。
- 仅作思路或格式参考时，不生成 `THIRD-PARTY-NOTICES.txt` 等第三方代码许可声明文件，不复制上游许可证到业务源码目录，也不将自主实现标注为上游代码移植。参考来源与研究过程放在本地参考文档／项目知识库中。
- 已存在的实际第三方依赖（如 `native/vendor/minhook/`）与参考项目分开管理，保留其现有来源、许可证及打包约定；本规则不要求删除已有依赖声明。新增第三方源码依赖必须由用户明确决定，代理不得以“参考”为由自行引入。
- 当前 Wolf 文本解析器存在标注为 WolfTL JS 移植的历史实现，入口为 `src/engine/wolf/text/fileParser.js`、`binaryReader.js`，其独立 `THIRD-PARTY-NOTICES.txt` 已移除，历史来源和许可合并保留在同目录 `README.md`。这不符合上述新实现规则，后续需单独处理；在替换并核实实现来源前，不得仅删除声明或改写注释来宣称已完成自主实现。

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
npm run test:native:unit
npm run dist
```

`build:native` 需要 Windows Visual Studio C++ x86 工具和 CMake。`test:native` 会启动并正常关闭自建测试窗口；指定实际游戏的方法见 P0/P1 状态文档。原生输出 `native/build/` 不提交。

验证应与改动范围匹配：UI 或类型变更至少运行 `npm run build`；注入、备份或 AI 逻辑还应运行对应测试。`npm run lint` 当前扫描整个仓库，遇到既有问题时要区分本次引入与历史问题。

## 修改文档时

- README 面向第一次访问项目的人：保持短、稳定、可快速运行，不放详细内部架构。
- 本文件面向 AI 和开发者：架构、入口、约束或命令变化时同步更新。
- 专项方案、迁移过程和较长设计讨论优先放在本机项目知识库；知识库不可用时可保留在本地 `docs/`，并明确标注“计划中”还是“已实现”。已有 `docs/` 作为参考保留，不自动删除或全量覆盖。
