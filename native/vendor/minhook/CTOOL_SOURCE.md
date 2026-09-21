# MinHook

用于原生函数拦截的开源 C 库，支持 x86 / x64。本项目当前将其静态链接到 x86 Wolf DLL。

- 上游：[TsudaKageyu/minhook](https://github.com/TsudaKageyu/minhook)
- 版本：v1.3.4
- 提交：`c3fcafdc10146beb5919319d0683e44e3c30d537`
- 许可证：**BSD-2-Clause（不是 MIT）**，完整声明见 [LICENSE.txt](LICENSE.txt)，其中同时保留了内含 HDE 反汇编组件的版权声明。
- 上游 `include/`、`src/` 与 `LICENSE.txt` 保持原样；本文件为项目自己的依赖记录。
- 源码已随仓库保存，构建时无需下载，也无需单独分发 MinHook DLL。

许可证允许使用、修改和商业分发。源码分发需保留版权、许可条件及免责声明；二进制分发需在附带文档或其他材料中包含这些声明。CMake 将完整许可证复制为 `MinHook-LICENSE.txt`，安装包资源配置负责携带该文件。此许可证只适用于本依赖，不改变 CTool 自身的许可证。
