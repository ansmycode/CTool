// import { app } from "electron";
import path from "path";
import fs from "fs";

const mvmzDetector = {
  name: "RPG Maker MV/MZ",
  readInfo: (gamePath) => {
    const gameDir = path.dirname(gamePath);
    try {
      const candidates = [
        {
          engine: "MV",
          coreFile: path.join(gameDir, "www", "js", "rpg_core.js"),
          dataFile: path.join(gameDir, "www", "data", "System.json"),
        },
        {
          engine: "MZ",
          coreFile: path.join(gameDir, "js", "rmmz_core.js"),
          dataFile: path.join(gameDir, "data", "System.json"),
        },
      ];
      const candidate = candidates.find(
        ({ coreFile, dataFile }) =>
          fs.existsSync(coreFile) && fs.existsSync(dataFile),
      );
      if (!candidate) return null;

      const { coreFile, dataFile, engine } = candidate;
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
        engine: engineMatch?.[1] || engine,
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
