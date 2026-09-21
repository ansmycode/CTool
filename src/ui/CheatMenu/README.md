# 修改器界面目录

`index.tsx` 按引擎分流，`index.css` 保留两种引擎共用的页面布局样式。

```text
CheatMenu/
  index.tsx
  index.css
  mvmz/
    MvmzCheatMenu.tsx      MV/MZ 状态与页面编排
    tabRegistry.tsx        MV/MZ 页签注册和懒加载
    components/           MV/MZ 专用库存表
    pages/                主页、角色、物品、变量、开关、翻译、快捷键
  wolf/
    WolfCheatMenu.tsx      Wolf 初始化与页签编排
    base/                 基础功能、金币、速度与穿墙
    inventory/            库存加载与展示
    variables/            数值变量页面
  shared/
    components/           搜索栏、失焦数字输入及对应样式
    hooks/                表格搜索、滚动高度、草稿值
```

引擎页面通过 adapter 获取数据，不互相引用。`shared` 只承载不解释游戏数据语义的组件和 Hook；通用外观不代表写入规则相同，两个引擎的库存表继续独立维护。页级样式与对应页面放在一起。

新增页面放入对应引擎目录。移动组件后同时检查开发预览、测试的源码路径以及根目录 `AGENTS.md` 和 `docs/` 的相关入口。
