import type { GameTextOperation, GameTextTranslationAccess } from "../textTranslation";

/** File extraction and runtime dictionary loading have separate session-bound IPCs. */
export function createWolfTextTranslation(sessionId?: string): GameTextTranslationAccess {
  const operations = {
    extract: { label: "提取游戏文本", available: Boolean(sessionId), reason: sessionId ? "从解析缓存生成纯净 JSON；首次使用会解析 Data 文件" : "Wolf 游戏会话未就绪" },
    load: { label: "加载翻译文本", available: Boolean(sessionId), reason: "选择已翻译的纯净 JSON，在本次游戏会话内应用" },
    embed: { label: "内嵌游戏文本", available: false, reason: "Wolf 文件内嵌翻译尚未接入" },
  } as const;
  const unavailable = (operation: GameTextOperation): Promise<void> =>
    Promise.reject(new Error(sessionId ? operations[operation].reason : "Wolf 游戏会话未就绪"));

  return {
    operations,
    extract: () => sessionId ? window.electronAPI.extractWolfText(sessionId)
      : Promise.reject(new Error("Wolf 游戏会话未就绪")),
    load: () => window.electronAPI.loadWolfTranslation(sessionId ?? ''),
    status: () => window.electronAPI.getWolfTranslationStatus(sessionId ?? ''),
    unload: () => window.electronAPI.clearWolfTranslation(sessionId ?? ''),
    // Future implementation: Wolf-specific file format, backup and restore workflow.
    embed: () => unavailable("embed"),
  };
}
