# Wolf P0/P1 实施与验证记录

后续功能：已添加只读金币 MVP，见 [实现与验收说明](WOLF_GOLD_MVP.md)。本文保留 P0/P1 首轮状态与历史验证范围。

日期：2026-09-13。范围：固定 x86 样本的启动、最小 DLL 和会话连接；尚无作弊、文本采集或翻译 Hook。

后续调整：已取消启动时的固定 SHA-256 白名单。识别到的 x86 Wolf EXE 可尝试启动，哈希仅保留为诊断信息，不绑定已验证的功能 profile；x64 和 DLL 仍不放行。下文固定样本限制描述为首轮验证时的历史状态，不代表当前启动条件。

## 已实现链路

Main / GameHistory → preload.launchGame → gameSessionService → engines/registry
- MV/MZ → mvmzDriver → 原插件注入/HTTP → 会话 ready → CheatMenu。
- Wolf → wolfDriver → inject-x86.exe → x86 Game.exe + ctool-wolf-x86.dll。
- DLL → 受限 Named Pipe → injector → JSON Lines stdout → wolfDriver → 会话快照与事件 → 状态页。

Named Pipe 服务端实际位于 injector，由 Win32 设置当前用户 ACL、拒绝远程连接，并验证管道客户端 PID。Electron 通过 helper stdio 管理它。相比最初方案中 Electron 直接创建 pipe，这样能明确控制 Windows 安全属性。P1 的 pipe 只单向传递 DLL hello/heartbeat；双向游戏 RPC 留待下一阶段。

检测使用路径、PE、Wolf 产品标记和 SHA-256；只允许基线指纹启动。FileVersion 仅用于显示。Wolf Adapter 当前为空能力，UI 显示 DLL 连接信息，不创建假的金币/物品页。现有 MV/MZ 数据仍走 5000；5001 ready 回调进入统一会话。

## 原生启动时序

CREATE_SUSPENDED 的新进程尚未初始化模块列表。初次测试枚举模块失败（Win32 299）；停在系统初始断点又会保留 loader lock，使远程加载线程超时。

当前实现使用 DEBUG_ONLY_THIS_PROCESS：
1. 挂起创建游戏，恢复加载器执行。
2. 在 PE 入口点设置一次临时断点，等待系统加载器完成。
3. 到入口点后恢复原字节与 EIP，暂停主线程，解除调试关系。
4. 按目标模块基址解析 LoadLibraryW 地址，加载 DLL，再恢复主线程。
5. helper 监视实际游戏句柄；正常窗口关闭后向 CTool 报告 exited。

断点仅改本次进程内存，不改磁盘 EXE；不安装游戏功能 Hook。含特殊 TLS、保护或反调试的其他程序尚未验证，因此仍严格限定样本。DLL 退出工作线程后保持映射，随游戏进程退出释放，不做不安全的强制卸载。

## 运行与构建

需要 Visual Studio C++ x86 工具、Windows SDK 和 CMake（已验证 VS 2019）。

~~~powershell
npm run build:native
npm run dev
npm run test:wolf
npm run test:native
~~~

原生输出：native/build/Release/inject-x86.exe 和 ctool-wolf-x86.dll。测试夹具 wolf-fixture.exe 不打包。npm run dist 会先构建原生组件，通过 extraResources 放到 native/wolf/x86。

测试指定游戏的命令（会在握手后请求正常关闭本次游戏窗口）：

~~~powershell
node scripts/smoke-wolf.mjs --game "F:\BaiduNetdiskDownload\testgame\Game.exe"
~~~

## 已观察的结果

- 本地基线：Ver2.2961 / x86。
- SHA-256：795203a6e875618d7fbdc7dd1f409a445c60262c911745553d040081bedb6ac0。
- 自建 x86 窗口程序：spawned → injected → hello → exited，全链路通过。
- 指定 Wolf 游戏：同样完成握手及正常关闭，磁盘 Game.exe 哈希未变化。
- 实际 CTool UI：选择游戏后识别版本，点击启动出现实际 PID 与“DLL 已连接”，关闭游戏后返回启动页。
- 观察范围到游戏初始化窗口；没有操作进入地图、修改变量、加载译文或验证完整游玩兼容性。连接成功不代表引擎数据已经就绪。
- 前端与原生构建通过；Wolf 测试 12 项、既有 AI 12 项、备份 3 项、插件注入 2 项通过。新增适配器和启动页的定向 ESLint 检查通过，全仓 lint 仍有历史问题。
- 最终回归修复了管道提前连接时无待处理 IO 却进入清理等待的问题；修复后夹具和指定游戏均完成握手、游戏退出及 helper 正常退出，EXE 哈希不变。
- 本机 MSBuild 与 Electron 用户缓存需要正常用户权限；在受限沙箱运行可能失败，已在获得运行权限后验证。

## 后续缺口

- 真实引擎 profile、功能级动态能力、分页数据库 UI、双向 RPC 和命令队列均未实现。
- x64 Wolf、未知哈希、中文/空格游戏路径组合以及安装包实机尚未全部验收。
- MV/MZ 回归目前覆盖代码构建、现有注入/备份测试和会话模拟；本轮没有额外的真实 MV/MZ 游戏样本进行全流程验收。
- helper 崩溃后保守监视 PID 消失；PID 若被重用可能继续阻止新会话，不把它误判为原游戏退出。
- 主进程没有收到退出信号时保留失败会话，正常游戏不被强杀。
- 改动后的完整架构目标仍见 WOLF_IMPLEMENTATION_PLAN.md。下一步：确认基线游戏正常进入场景，再以只读诊断建立文本 Hook profile。
