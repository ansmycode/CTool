# CTool 开发页面预览计划

> 状态：待实施  
> 前置条件：当前游戏数据与 CheatMenu 架构优化完成并通过人工验证  
> 原则：仅开发环境可用，不改变生产环境页面入口和游戏通信逻辑

## 1. 目标

为必须满足特定运行条件才能访问的页面提供快速预览入口。例如开发 CheatMenu 布局时，无需每次选择、注入并启动真实游戏。

计划支持 URL 参数直接进入页面：

```text
http://127.0.0.1:5173/?preview=cheat-menu
http://127.0.0.1:5173/?preview=game-history
http://127.0.0.1:5173/?preview=author-info
```

## 2. 实现原则

- 使用 `import.meta.env.DEV` 作为第一层限制。
- 生产构建不读取或响应 `preview` 参数。
- 预览页面不调用真实游戏 API，不要求启动游戏。
- CheatMenu 使用单独的 Mock Adapter 和统一格式的 Mock 数据。
- Mock 文件集中放在 `src/dev/`，不在真实 Adapter 和业务组件中散布 `if (DEV)`。
- 预览入口复用真实页面组件，以便检查实际布局和懒加载行为。

## 3. 计划结构

```text
src/dev/
├─ DevPreview.tsx          开发预览入口
├─ previewRegistry.ts      可预览页面注册表
├─ mockGameAdapter.ts      不访问真实游戏的 Adapter
└─ mockGameData.ts         统一格式的演示数据
```

## 4. 实施顺序

1. 建立 `previewRegistry`，解析并校验 `preview` 参数。
2. 在应用入口增加仅 DEV 生效的预览分支。
3. 接入历史页和作者页等无游戏通信页面。
4. 建立 Mock Adapter 和 Mock 数据。
5. 让 CheatMenu 预览使用 Mock Adapter，并跳过真实 `game-ready` 等待。
6. 增加不同能力组合，用于检查某个引擎缺少部分 Tab 时的布局。
7. 人工确认生产构建无法通过参数进入预览页面。

## 5. 验收条件

- 开发环境可直接打开已注册页面。
- CheatMenu 预览不会请求 `localhost:5000`。
- 点击预览页面中的修改操作不会影响真实游戏或本地文件。
- 可检查 Tab 懒加载和不同能力组合的页面结构。
- 正常 `npm run dev` 流程不受影响。
- 生产环境中 `preview` 参数无效。

## 6. 暂不处理

- 不制作完整的 Storybook 或独立组件文档站。
- 不模拟游戏注入、备份和文件写入流程。
- 不把 Mock Adapter 注册为正式支持的游戏引擎。
- 不保证 Mock 数据能够覆盖所有游戏特例。
