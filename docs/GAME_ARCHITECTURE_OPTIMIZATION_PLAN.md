# CTool 游戏数据与 CheatMenu 架构优化计划

> 状态：讨论稿  
> 日期：2026-08-12  
> 范围：游戏数据层、引擎适配层、CheatMenu 结构与加载方式  
> 原则：不新增或删除现有功能，不改变 MV/MZ 的通信协议、数据含义、操作顺序和页面行为

## 1. 优化目标

当前架构的核心思路是正确的：不同游戏引擎的数据和操作先经过 Adapter 统一，再由 `useGameData` 向 CheatMenu 提供一致的数据结构与方法。现阶段的问题主要是早期文件位置和职责边界没有完全落实：

- Adapter 位于公共 React 组件目录中。
- `useGameData` 与普通组件混放。
- `service/mvmzApi.ts` 大部分只是转发 API 调用，增加了调用层级。
- CheatMenu 已整体懒加载，但内部多数 Tab 仍会一次性加载。
- CheatMenu 的 Tab 固定写死，尚不能表达不同引擎的能力差异。
- 统一数据结构仍保留 `allItem`、`allMembers` 等 MV/MZ 原始命名。

本次优化采用轻量结构，不提前建立复杂的领域层和基础设施层：

```text
CheatMenu（展示）
        ↓
useGameData（React 状态与操作编排）
        ↓
EngineAdapter（通信、字段转换、能力声明）
        ↓
http.ts（通用 GET/POST）
        ↓
游戏中的注入 API
```

最终目标：

1. CheatMenu 只认识 CTool 的统一数据字段和统一操作。
2. `useGameData` 只管理状态、刷新、错误和修改后的重新取数。
3. Adapter 负责引擎通信、原始字段转换和能力差异。
4. 新增引擎时，不在 CheatMenu 中堆叠引擎判断。
5. 未使用的 CheatMenu Tab 不参与首次加载。

## 2. 目标目录结构

```text
src/
├─ game/
│  ├─ types.ts                 CTool 统一游戏数据、操作和能力类型
│  ├─ registry.ts              引擎与 Adapter 的注册关系
│  ├─ useGameData.ts           React 状态和操作编排
│  └─ adapters/
│     └─ mvmz.ts               MV/MZ 通信、字段转换和能力声明
│
├─ lib/
│  └─ http.ts                  与具体引擎无关的 HTTP 请求工具
│
└─ ui/
   └─ CheatMenu/
      ├─ index.tsx             页面外壳、连接状态和 Tab 渲染
      ├─ tabRegistry.tsx       通用 Tab 注册信息
      ├─ home/
      ├─ itemsTable/
      ├─ armorTable/
      ├─ weaponTable/
      ├─ variablesTable/
      ├─ switchesTable/
      ├─ actorTable/
      └─ translateTool/
```

初期不拆分 `mvmz/api.ts`、`mvmz/mapper.ts` 等文件。只有当 `mvmz.ts` 后续明显过大时，再在引擎目录内部按实际需要拆分。

## 3. 各层职责

### 3.1 CheatMenu

负责：

- 展示统一游戏数据。
- 调用 `useGameData` 暴露的统一操作。
- 根据统一能力决定显示哪些 Tab。
- 管理当前 Tab 和页面级加载提示。

不负责：

- 判断 MV、MZ、Wolf 等具体引擎。
- 识别引擎原始字段。
- 拼接 HTTP 地址或请求参数。
- 决定某个引擎如何完成修改操作。

### 3.2 useGameData

负责：

- 根据 `engineType` 从注册表取得 Adapter。
- 保存统一后的 `gameData`。
- 管理连接、加载和错误状态。
- 向 UI 暴露统一操作。
- 操作成功后重新获取数据，保持当前行为。

不负责：

- 转换 MV/MZ 原始字段。
- 编写引擎专用请求。
- 决定 Tab 的视觉结构。

### 3.3 EngineAdapter

负责：

- 与对应引擎进行通信。
- 将引擎原始数据转换为 CTool 统一结构。
- 将统一操作转换为引擎所需的请求和参数。
- 声明当前引擎支持的能力。

Adapter 初期使用普通对象，不使用没有内部状态需求的 class。

### 3.4 http.ts

只负责通用 HTTP 工作：

- URL 和查询参数处理。
- GET、POST 等请求。
- JSON/文本响应解析。
- HTTP 错误转换。

它不包含 MV/MZ 接口名称、字段映射或业务方法。

## 4. 必须保持不变的行为

整个改造期间，下列内容作为兼容基线：

- MV/MZ 仍共用同一个 Adapter。
- 游戏服务地址和所有 API 路径保持不变。
- 请求方法、请求参数名称和返回值处理保持不变。
- 修改操作完成后仍然重新获取完整游戏数据。
- `game-ready`、`game-closed` 等现有事件不改变。
- CheatMenu 当前八个 Tab 的名称、顺序和功能保持不变。
- 当前游戏启动、注入、翻译和历史记录逻辑不进入本次改造范围。
- 不修改游戏内 `inject` 脚本。

任何阶段如果需要改变以上内容，应停止并单独讨论，不能作为结构调整顺带完成。

## 5. 分阶段实施计划

### 第一阶段：建立统一类型与目录骨架

目标：先建立新边界，不改变任何运行代码。

工作内容：

1. 新建 `src/game/types.ts`。
2. 在其中定义：
   - `EngineType`
   - `GameData`
   - `GameEngineAdapter`
   - `GameCapability`
3. 新建 `src/game/registry.ts`、`src/game/adapters/` 和 `src/lib/` 目录。
4. 暂时允许统一类型继续使用当前字段名称，避免移动文件和字段重命名同时发生。

验收条件：

- 仅新增目录和类型定义。
- 页面和运行行为完全不变。
- 新类型能够覆盖当前 MV/MZ 的全部数据和操作。

### 第二阶段：迁移通用 HTTP 工具

目标：把纯通信工具移出含义模糊的 `service` 目录。

工作内容：

1. 将 `src/service/request.ts` 迁移为 `src/lib/http.ts`。
2. 只修正引用路径，不修改请求实现。
3. 保留当前基础 URL、错误处理和响应结构。

验收条件：

- 所有请求行为与迁移前一致。
- 项目中不再引用旧的 `service/request.ts`。
- 该阶段不合并 `mvmzApi.ts`，确保问题容易定位。

### 第三阶段：建立轻量 MV/MZ Adapter

目标：让 Adapter 真正成为 MV/MZ 的通信和适配边界。

工作内容：

1. 新建 `src/game/adapters/mvmz.ts`。
2. 将现有 `MVAdapter` 的方法迁入普通 Adapter 对象。
3. 将 `mvmzApi.ts` 中的 API 调用逐项合并到该 Adapter。
4. Adapter 直接调用 `src/lib/http.ts`。
5. 初期保持现有方法名、参数和返回数据不变。
6. 完成后删除已经没有引用的旧 `MVAdapter.ts` 和 `mvmzApi.ts`。

迁移前：

```text
useGameData → MVAdapter → mvmzApi → request
```

迁移后：

```text
useGameData → mvmzAdapter → http
```

验收条件：

- 每一个原 API 都能在 Adapter 中找到一一对应的实现。
- API 地址、请求方法和参数名称没有变化。
- 不在此阶段重命名游戏数据字段。

### 第四阶段：使用注册表选择 Adapter

目标：移除 `useGameData` 内不断扩大的引擎 `switch`。

工作内容：

1. 在 `src/game/registry.ts` 中注册引擎：

```ts
const engineAdapters = {
  MV: mvmzAdapter,
  MZ: mvmzAdapter,
};
```

2. 提供统一的 `getEngineAdapter(engineType)`。
3. 未支持的引擎继续抛出明确错误，不静默降级。

验收条件：

- MV 和 MZ 仍取得同一个 Adapter。
- `useGameData` 不再直接导入具体 MV/MZ Adapter。
- 新增引擎只需要新增 Adapter 和注册记录。

### 第五阶段：迁移并收敛 useGameData

目标：将 Hook 从公共组件目录移至游戏数据模块，并明确其职责。

工作内容：

1. 将 `src/components/useGameData.ts` 迁移至 `src/game/useGameData.ts`。
2. 通过注册表取得 Adapter。
3. 保持当前“执行修改后重新读取数据”的行为。
4. 整理重复的操作包装，但不改变调用时序。
5. 保留当前对 CheatMenu 暴露的方法名称，减少 UI 改动范围。

验收条件：

- CheatMenu 只从 `src/game/useGameData.ts` 导入 Hook。
- `components` 目录不再包含 Adapter 或游戏状态 Hook。
- MV/MZ 的取数和修改流程保持一致。

### 第六阶段：统一 CTool 数据字段

目标：让 Menu 不再使用带有 MV/MZ 痕迹的字段名称。

建议映射：

| MV/MZ 原始字段 | CTool 统一字段 |
| --- | --- |
| `allItem` | `items` |
| `allArmors` | `armors` |
| `allWeapons` | `weapons` |
| `allMembers` | `actors` |
| `classList` | `classes` |
| `variables` | `variables` |
| `switches` | `switches` |

工作内容：

1. 在 Adapter 的 `getData()` 中完成字段转换。
2. `useGameData` 只保存 Adapter 返回的统一数据。
3. 逐个修改 CheatMenu Tab 的属性读取。
4. 一次只迁移一类数据，避免一次性修改所有表格。

验收条件：

- CheatMenu 中不再出现 `allItem`、`allMembers` 等引擎原始命名。
- Adapter 是唯一理解 MV/MZ 原始字段的前端模块。
- 数据内容、数组顺序和修改目标不发生变化。

### 第七阶段：加入轻量能力声明

目标：表达不同引擎支持哪些功能，但不建立复杂权限系统。

能力使用字符串联合类型和集合：

```ts
type GameCapability =
  | "gold"
  | "items"
  | "armors"
  | "weapons"
  | "variables"
  | "switches"
  | "actors"
  | "translation";
```

Adapter 声明自身能力：

```ts
capabilities: new Set<GameCapability>([
  "gold",
  "items",
  "armors",
  "weapons",
  "variables",
  "switches",
  "actors",
  "translation",
]);
```

工作内容：

1. `useGameData` 将能力集合原样提供给 CheatMenu。
2. CheatMenu 根据能力过滤通用 Tab。
3. MV/MZ 初始能力必须覆盖当前全部八个 Tab，确保页面没有变化。
4. 不通过数据是否为空判断功能是否受支持。

验收条件：

- MV/MZ 的 Tab 数量、顺序和内容与当前一致。
- CheatMenu 不出现 `engine === "MV"` 等条件分支。
- 未来 Adapter 可通过能力集合隐藏不支持的 Tab。

### 第八阶段：拆分 CheatMenu Tab 注册与懒加载

目标：减轻 CheatMenu 首次进入时的加载量，并为引擎能力过滤提供统一入口。

工作内容：

1. 新建 `src/ui/CheatMenu/tabRegistry.tsx`。
2. 每个 Tab 注册：
   - 固定 key
   - 标题
   - 所需能力
   - 懒加载组件
3. 将 Home、道具、防具、武器、变量、开关、角色和翻译页都改为 `React.lazy()`。
4. CheatMenu 根据能力生成 Ant Design `items`。
5. 所有 Tab 共用内容区域居中的加载提示。
6. 默认首页仍为第一个 Tab，不改变用户操作路径。

验收条件：

- 进入 CheatMenu 时不再同步加载所有表格组件。
- 第一次切换某个 Tab 时才加载对应分包。
- 同一次运行中再次切换不重复加载。
- Tab 的现有 props 和功能保持不变。

### 第九阶段：清理旧文件与注释

目标：在新结构稳定后清理迁移痕迹。

工作内容：

1. 删除没有引用的旧文件和空目录。
2. 修正失效注释和重复接口成员。
3. 统一 Adapter、能力和统一字段的命名。
4. 更新架构说明和新增引擎的接入步骤。

验收条件：

- 不存在新旧实现并行维护。
- `components` 只保留 React 公共组件。
- `service` 目录如果为空则移除。
- 文档能够指导新增一个最小 Adapter。

## 6. 为什么采用这个实施顺序

计划刻意避免同时进行以下三类修改：

1. 文件位置迁移。
2. 数据字段重命名。
3. CheatMenu 页面结构调整。

如果三者同时发生，出现问题时难以判断是导入路径、字段转换还是页面渲染导致。当前顺序先固定底层结构，再迁移状态层，最后调整 UI，每个阶段都能单独对照原实现。

```text
建立类型
  → 移动 HTTP
  → 合并 MV/MZ Adapter
  → 建立注册表
  → 迁移 useGameData
  → 统一字段
  → 声明能力
  → Tab 注册与懒加载
  → 清理旧结构
```

## 7. 每阶段改动对比要求

每一阶段完成后都需要提供：

1. 修改和移动的文件清单。
2. 原调用链与新调用链对比。
3. 字段和方法的一一映射表。
4. 为什么这样修改。
5. 明确说明哪些功能逻辑保持不变。
6. 当前阶段尚未处理的问题，避免顺手扩大范围。

涉及删除旧文件时，只有确认项目中已经没有引用后再删除。

## 8. 风险与控制措施

| 风险 | 控制方式 |
| --- | --- |
| API 参数在合并 Adapter 时被改名 | 逐个方法对照迁移，第三阶段不做字段统一 |
| 字段转换造成 UI 空数据 | 第六阶段按数据类别逐个迁移 |
| 能力过滤误隐藏 MV/MZ Tab | MV/MZ 初始能力覆盖当前所有功能 |
| 懒加载导致 props 丢失 | 保持现有 Tab 组件接口，只改变导入方式 |
| 旧文件和新文件同时被引用 | 每阶段使用全局引用检查确认唯一入口 |
| 架构继续过度拆分 | 单个 Adapter 未明显膨胀前不再拆 api/mapper/service |

## 9. 第一轮优化的完成标准

完成上述阶段后，应达到：

- 当前 MV/MZ 功能和界面行为保持不变。
- CheatMenu 不接触任何 MV/MZ 原始字段。
- CheatMenu 不按具体引擎名称写条件分支。
- `useGameData` 不包含具体引擎通信实现。
- MV/MZ 的通信和转换集中在一个 Adapter 中。
- 新引擎可通过“Adapter + 注册记录 + 能力集合”接入。
- 不支持的 Tab 可以由能力集合排除。
- CheatMenu 各 Tab 按需加载。
- 目录结构能够从文件位置直接表达职责。

## 10. 暂不处理的内容

为避免本次结构优化扩大为功能重写，以下内容不在第一轮范围内：

- 新增 Wolf 或其他引擎的真实实现。
- 修改游戏内注入脚本和 API 协议。
- 修改 HTTP 服务端口或通信方式。
- 重新设计 CheatMenu 的视觉界面。
- 修改游戏历史、翻译、备份或注入功能。
- 引入状态管理库、依赖注入框架或复杂插件系统。
- 为不存在的引擎提前设计大量抽象类型。

只有当第二个引擎实际接入并暴露出真实差异后，再根据具体需求扩展统一模型。
