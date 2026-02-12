export const authorFaqData = [
  {
    question: "这个工具是干什么的？",
    answer: (
      <>
        本工具用于为 RPG 游戏提供 <strong>实时修改</strong> 与{" "}
        <strong>文本翻译</strong> 功能，方便玩家在游玩过程中调整数值或进行本地化体验。
      </>
    ),
  },
  {
    question: "适合哪些游戏？",
    answer: (
      <ul>
        <li>RPG Maker MV</li>
        <li>RPG Maker MZ</li>
      </ul>
    ),
  },
  {
    question: "有哪些注意事项？",
    answer: (
      <ul>
        <li>大部分说明已写在各功能按钮的悬浮提示中</li>
        <li>使用前请务必做好游戏与数据备份</li>
        <li>不建议在未保存游戏时频繁修改数值</li>
      </ul>
    ),
  },
  {
    question: "已知问题",
    answer: (
      <ul>
        <li>文本提取功能不完整（暂未适配插件中的文本）</li>
        <li>内嵌文本翻译功能稳定性不足</li>
      </ul>
    ),
  },
  {
    question: "未来计划",
    answer: (
      <ul>
        <li>适配更多老版本引擎</li>
        <li>支持 Wolf RPG 引擎</li>
        <li>对工具进行长期维护并持续修复 Bug</li>
      </ul>
    ),
  },
];
