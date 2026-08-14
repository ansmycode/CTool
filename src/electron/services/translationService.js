/**
文本提取
翻译文件保存与读取
数据备份与内嵌翻译
builtin-status 状态发送
 */

import fs from "fs";
import path from "path";
import {
  createGameDataBackup,
  isKnownGameDataBackup,
} from "./gameDataBackupService.js";
import { getTranslationEngineAdapter } from "./translationEngineAdapters.js";

async function loadTranslationTools() {
  return import("../../engine/mvmz/extract.js");
}

export async function extractGameText(gameInfo) {
  if (!gameInfo.gamePath || !gameInfo.engine) return;
  if (gameInfo.engine !== "MV" && gameInfo.engine !== "MZ") return;

  const gameDir = path.dirname(gameInfo.gamePath);
  try {
    const { ExtractText } = await loadTranslationTools();
    return await ExtractText(gameDir, gameInfo.engine);
  } catch (error) {
    return error.message;
  }
}

export function saveTranslationFile(textArr, gameInfo) {
  if (!textArr.length > 0) return;

  const gameDir = path.dirname(gameInfo.gamePath);
  const outputPath = path.join(gameDir, "CatToolTranslate.json");
  const textJson = {};
  textArr.forEach((item) => (textJson[item] = item));

  try {
    fs.writeFileSync(outputPath, JSON.stringify(textJson, null, 2), "utf-8");
  } catch (error) {
    console.error("写入翻译文件失败:", error);
  }
}

export async function processBuiltInTranslation(
  event,
  translationFilePath,
  gameInfo,
  currentBackupPath,
) {
  const gameDir = path.dirname(gameInfo.gamePath);
  try {
    const translationData = JSON.parse(
      fs.readFileSync(translationFilePath, "utf8"),
    );
    if (!translationData || Array.isArray(translationData) || typeof translationData !== "object") {
      throw new Error("内嵌翻译文件必须是键值 JSON 对象。");
    }
    const adapter = getTranslationEngineAdapter(gameInfo.engine);
    const target = adapter.resolveTarget(gameDir);
    if (!isKnownGameDataBackup(gameInfo, currentBackupPath)) {
      await createGameDataBackup(gameInfo, event);
    }

    const { replaceFromObject } = await loadTranslationTools();
    await adapter.applyTranslation({
      target,
      translationData,
      replaceFromObject,
      onProgress: (data) => {
        event.sender.send("builtin-status", {
          status: "builting",
          data,
        });
      },
    });

    event.sender.send("builtin-status", { status: "done" });
    return { status: "success", message: "翻译完成，文件已替换。" };
  } catch (error) {
    console.error("翻译失败:", error);
    event.sender.send("builtin-status", {
      status: "error",
      message: error.message,
    });
    throw error;
  }
}

export function readTranslationJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}
