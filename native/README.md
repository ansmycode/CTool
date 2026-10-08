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

进程与 DLL 位数必须匹配；当前业务布局仅适配 x86。MinHook 自身支持 x64，不代表 CTool 已支持 x64 Wolf。MinHook 使用 **BSD-2-Clause**，许可证随组件分发，详见 [MinHook 来源](vendor/minhook/CTOOL_SOURCE.md)。
