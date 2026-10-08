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

格式读取逻辑移植参考 WolfTL 固定版本，来源和 MIT 许可见 `THIRD-PARTY-NOTICES.txt`。
