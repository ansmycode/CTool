# 原生组件

CTool 的 Windows Wolf x86 注入、通信与运行时能力。源码按进程职责组织，构建产物位于 `build/`，不作为编辑入口，也不提交。

| 路径 | 职责 |
| --- | --- |
| [injector/main.cpp](injector/main.cpp) | 创建游戏进程、入口点注入、Named Pipe 服务及进程生命周期 |
| [wolf/main.cpp](wolf/main.cpp) | DLL 入口、握手与请求分发 |
| [wolf/database_reader.h](wolf/database_reader.h) | 数据库定位、目录/分页读取及受限数字写入 |
| [wolf/runtime_control.h](wolf/runtime_control.h) | 变量、速度、穿墙协议路由 |
| [wolf/runtime_memory.h](wolf/runtime_memory.h) | 可执行节特征扫描和数值变量容器访问 |
| [wolf/runtime_hooks.h](wolf/runtime_hooks.h) | 计时 API 拦截与穿墙开关 |
| [tests/](tests/) | 自建游戏窗口、数据库与运行时测试夹具 |
| [vendor/minhook/](vendor/minhook/) | 固定版本的第三方 Hook 库及完整许可证 |
| [CMakeLists.txt](CMakeLists.txt) | 构建目标、静态依赖与许可证复制规则 |

在仓库根目录执行：

```powershell
npm run build:native
npm run test:native:unit
```

需要 Visual Studio C++ x86 工具与 CMake。产物包括 `build/Release/inject-x86.exe`、`ctool-wolf-x86.dll` 和 `MinHook-LICENSE.txt`。`test:native:unit` 不启动真实游戏；`test:native` 使用自建窗口执行启动烟测，实际游戏测试方法见 [状态文档](../docs/WOLF_P1_STATUS.md)。

进程与 DLL 位数必须匹配；当前业务布局仅适配 x86。MinHook 自身支持 x64，不代表 CTool 已支持 x64 Wolf。第三方依赖使用 **BSD-2-Clause**，其版权和许可证不能作为无用文件清理，详见 [来源说明](vendor/minhook/CTOOL_SOURCE.md)。

进一步阅读：[代码导读](../docs/WOLF_CODE_WALKTHROUGH.md)、[运行时功能](../docs/WOLF_RUNTIME_FEATURES.md)、[文档目录](../docs/README.md)。
