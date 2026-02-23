// import { app } from "electron";
import path from "path";
import fs from "fs";
import { findFileOrDirWithDepthLimit } from "./tool.js";

/**
 * 递归查找文件/目录
 * @param {string} dir 起始目录
 * @param {string[]} targetFiles 目标文件名数组
 * @param {number} maxDepth 最大递归深度
 * @param {number} currentDepth 当前递归深度（初始调用时传0）
 * @returns {string|object} 找到文件返回文件路径 找到文件夹返回对象 保存文件夹路径与文件夹里的文件路径
 */
const mvmzDetector = {
  name: "RPG Maker MV/MZ",
  readInfo: (gamePath) => {
    const gameDir = path.dirname(gamePath);
    const targetFiles = ["rpg_core.js", "rmmz_core.js"];
    const maxDepth = 3; // 限制递归深度3层
    try {
      const coreFile = findFileOrDirWithDepthLimit(
        gameDir,
        targetFiles,
        maxDepth
      );
      if (!coreFile) return null;
      const dataFile = findFileOrDirWithDepthLimit(
        gameDir,
        ["System.json"],
        maxDepth
      );
      const content = fs.readFileSync(coreFile, "utf-8");
      const system = JSON.parse(fs.readFileSync(dataFile, "utf-8"));
      const engineMatch = content.match(
        /Utils\.RPGMAKER_NAME\s*=\s*["'](.*?)["']/
      );
      const versionMatch = content.match(
        /Utils\.RPGMAKER_VERSION\s*=\s*["'](.*?)["']/
      );

      return {
        title: system.gameTitle,
        version: versionMatch[1] || "N/A",
        engine: engineMatch[1] || "Unknown",
        gamePath,
      };
    } catch {
      return null;
    }
  },
};

const detectors = [mvmzDetector];

//读取游戏信息
export function detectAndReadInfo(gamePath) {
  for (const detector of detectors) {
    if (detector.readInfo(gamePath)) {
      const info = detector.readInfo(gamePath);
      return info;
    }
  }
  return {
    title: "无法识别",
    version: "N/A",
    engine: "Unknown",
    gamePath: "无",
    error: "错误,未查询到游戏信息",
  };
}


// 恢复原始的 index.html 文件
export function restoreOriginalHtml(gameDir) {
  const indexPath = path.join(gameDir, "www", "index.html");
  // const indexPath = findFileOrDirWithDepthLimit(gameDir, ["index.html"], 3);

  const backupPath = indexPath + ".bak";

  if (fs.existsSync(backupPath)) {
    // 还原备份的 index.html
    fs.copyFileSync(backupPath, indexPath);
    console.log("index.html 已还原为备份文件");
  } else {
    console.log("未找到备份文件");
  }
}

// 删除备份的 .bak 文件
export function deleteBackupFile(gameDir) {
  const backupPath = path.join(gameDir, "www", "index.html.bak");
  // const backupPath = findFileOrDirWithDepthLimit(gameDir, ["index.html"], 3);

  if (fs.existsSync(backupPath)) {
    fs.unlinkSync(backupPath); // 删除备份文件
    console.log("备份文件 index.html.bak 已删除");
  } else {
    console.log("未找到备份文件");
  }
}
