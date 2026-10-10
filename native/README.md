# 原生组件

CTool 的 Windows Wolf x86 注入、通信、运行时能力。源码按进程职责组织，构建产物位于 `build/`，不作为编辑入口，也不提交。

| 路径 | 职责 |
| --- | --- |
| [injector/main.cpp](injector/main.cpp) | 创建游戏进程、入口点注入、Named Pipe 服务及进程生命周期 |
| [wolf/main.cpp](wolf/main.cpp) | DLL 入口、握手与请求分发 |
| [wolf/database_reader.h](wolf/database_reader.h) | 数据库定位、目录/分页读取及受限数字写入 |
| [wolf/runtime_control.h](wolf/runtime_control.h) | 变量、速度、穿墙协议路由 |
| [wolf/runtime_memory.h](wolf/runtime_memory.h) | 可执行节特征扫描和数值变量容器访问 |
| [wolf/runtime_hooks.h](wolf/runtime_hooks.h) | 计时 API 拦截与穿墙开关 |
| [wolf/font_override.h](wolf/font_override.h) | 启动前私有字体加载、GDI 字体创建 API 拦截，按游戏主程序调用范围替换 |
| [wolf/text_hook.h](wolf/text_hook.h) | 文本目标定位、x86 寄存器保留、引擎字符串替换与会话卸载 |
| [wolf/text_dictionary.h](wolf/text_dictionary.h) | 不可变译文字典和分批加载 |
| [wolf/text_format.h](wolf/text_format.h)、[wolf/text_matcher.h](wolf/text_matcher.h) | 编码、纯净文本校验、控制包分离与保留控制符的文本匹配 |
| [tests/](tests/) | 自建游戏窗口、数据库与运行时测试夹具 |
| [vendor/minhook/](vendor/minhook/) | 固定版本的第三方 Hook 库及完整许可证 |
| [CMakeLists.txt](CMakeLists.txt) | 构建目标、静态依赖与许可证复制规则 |

在仓库根目录执行：

```powershell
npm run build:native
npm run test:native:unit
```

需要 Visual Studio C++ x86 工具与 CMake。产物包括 `build/Release/inject-x86.exe`、`ctool-wolf-x86.dll` 和 `MinHook-LICENSE.txt`。`test:native:unit` 不启动真实游戏；`test:native` 使用自建窗口执行启动烟测，实际游戏测试方法见 [状态文档](../docs/WOLF_P1_STATUS.md)。离线文本解析已迁移到 `src/engine/wolf/text/` 的 JS Worker，不需要原生构建。

## 数字批量读取

2026-10-09 新增 `numericReadProtocol=1` 握手能力与 `numberpage id kind table start limit field` 命令，最多 100 行、一个数字字段；响应保留结构和 ID 校验信息，省去逐行文本名称读取。原 `page` 仍最多十行、十六字段。主进程发现旧 DLL 未声明该能力时，将数字请求拆为十行 `page` 并校验合并结果。

新增命令同时需要新版 injector 转发和 DLL 实现，请一起更新两个原生产物并重启游戏。`test:native` 检查新命令穿过 injector 和 DLL 的往返；自建窗口没有游戏数据库，返回不可用是预期结果。原生单测另验证 100 行读取、数字类型及上限拒绝。分页重新解析内存结构，不保存地址，也不保证跨请求原子快照。

进程与 DLL 位数必须匹配；当前业务布局仅适配 x86。MinHook 自身支持 x64，不代表 CTool 已支持 x64 Wolf。MinHook 使用 **BSD-2-Clause**，许可证随组件分发，详见 [MinHook 来源](vendor/minhook/CTOOL_SOURCE.md)。

## 启动字体

启动页选择原字体或 Noto Sans CJK SC；Wolf 使用本节原生路径；MV/MZ 使用独立 inject/font.js 插件加载。主进程校验内置资源 ID 与 SHA-256，injector 可接收第五个可选参数（字体绝对路径）。游戏仍暂停于入口点时，DLL 以 `FR_PRIVATE` 加载字体、验证物理字体并安装 GDI 创建 API Hook；成功事件到达后 injector 才恢复主线程，失败则终止尚未开始执行的游戏并报告错误。旧 DLL 不会被误报为支持字体。

拦截 CreateFontA/W、CreateFontIndirectA/W、CreateFontIndirectExA/W，覆盖 Wolf 动态 GetProcAddress 路径；仅更改游戏 EXE 发起调用的字体名称，保留字号、宽度、样式和字符集。SYMBOL_CHARSET 的图标字体及外部 DLL 调用保持原样。测量和绘制继续使用游戏创建的同一 HFONT。字体保持至游戏进程退出，工具断连不撤销；没有运行时修改字体的协议或 CheatMenu 入口。

资源位于 `tool_data/fonts/`，字体原文件与许可证一同打包，不安装系统字体或覆盖游戏字体。`test:native:unit` 增加物理字形、动态 API 和调用范围测试；`node scripts/smoke-wolf.mjs --font tool_data/fonts/noto-sans-cjk-sc/NotoSansCJKsc-Regular.otf` 检查启动前字体门控和实际字体创建次数。GDI 之外的字体路径、从外部 DLL 发起的绘制、文字图片与编码限制不在首版覆盖范围；实际菜单/对白布局仍需用户验收。
