/**
文本提取
翻译文件保存与读取
数据备份与内嵌翻译
builtin-status 状态发送
 */

import fs from "fs";
import path from "path";
import { findFileOrDirWithDepthLimit } from "../../utils/tool.js";

async function loadTranslationTools() {
  return import("../../engine/mvmz/extract.js");
}

export async function extractGameText(gameInfo) {
  if (!gameInfo.gamePath || !gameInfo.engine) return;
  if (gameInfo.engine !== "MV" && gameInfo.engine !== "MZ") return;

  const gameDir = path.dirname(gameInfo.gamePath);
  try {
    const { ExtractText } = await loadTranslationTools();
    return await ExtractText(gameDir);
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

export async function processBuiltInTranslation(event, chooseFile, gamePath) {
  const gameDir = path.dirname(gamePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupName = `data_backup_${timestamp}.zip`;

  try {
    event.sender.send("builtin-status", { status: "backup" });
    const found = findFileOrDirWithDepthLimit(gameDir, ["data"], 3);
    const { backup, replaceFromObject } = await loadTranslationTools();
    const backupFile = await backup(found.path, path.join(gameDir, backupName));
    console.log(`备份完成：${backupFile}`);
    event.sender.send("builtin-status", { status: "backupend" });

    const translationData = JSON.parse(
      fs.readFileSync(chooseFile.filePaths[0], "utf-8"),
    );
    let process = 0;

    found.files.forEach((file) => {
      if (!file.endsWith(".json")) return;

      let content = JSON.parse(fs.readFileSync(file, "utf-8"));
      if (Array.isArray(content)) {
        content = content.map((item) =>
          replaceFromObject(item, translationData),
        );
      } else {
        content = replaceFromObject(content, translationData);
      }

      fs.writeFileSync(file, JSON.stringify(content, null, 2));
      process++;
      event.sender.send("builtin-status", {
        status: "builting",
        data: { current: process, total: found.length },
      });
    });

    event.sender.send("builtin-status", { status: "done" });
    return { status: "success", message: "翻译完成，文件已替换。" };
  } catch (error) {
    console.error("翻译失败:", error);
    event.sender.send("builtin-status", {
      status: "error",
      message: error.message,
    });
  }
}

export function readTranslationJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}
