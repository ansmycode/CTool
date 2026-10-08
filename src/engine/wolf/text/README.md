# Wolf 离线文本解析

- `binaryReader.js`：有边界检查的二进制读取、Shift-JIS/UTF-8 解码、普通文件的 LZ4 块解压。
- `fileParser.js`：MPS、公共事件 DAT、DAT + project 数据库、Game.dat 的只读结构解析。
- `parserWorker.js`：在 Node Worker 中执行解析，避免阻塞 Electron 主线程。
- `cache.js`：首次解析到临时目录，成功后成为正式缓存；后续只从缓存重新生成 JSON。
- `extractText.js`：筛选可翻译字段、拆行、清理控制符、去重并记录来源。

修改这些 JS 文件后重启 Electron 即可用于开发，不需要 `build:native`。发布时仍正常构建和打包应用。
数据库的字段名称与记录标签来自同名 `.project`；MPS、公共事件、Game.dat 不依赖它。
MapTree、MapTreeOpenStatus、TileSetData 暂不提取，结果中分别说明用途，不误报为缺少 project。
解析输出只保留文本相关结构，不是可完整回写的游戏工程；不支持资源包解包、Pro 或加密文件。

当前解析器为历史上的 WolfTL JavaScript 移植实现，尚未完成自主实现替换。原独立声明文件已移除，其来源和许可合并保留于下文。

## 历史实现来源与许可

Wolf file format readers ported from Sinflower/WolfTL
https://github.com/Sinflower/WolfTL
Commit: bfc38fc2735ab4f7f7ddbec8d57b7fef65f0712f
Upstream header notices also credit Copyright (c) 2025 and 2026 Sinflower.
Upstream credits https://github.com/elizagamedev/wolftrans for parsing design.
CTool: read-only JavaScript port; no archive extraction, encryption or file writing.

MIT License

Copyright (c) 2024 Sinflower

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
