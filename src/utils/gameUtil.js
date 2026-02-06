import { app } from "electron";
import path from "path";
import fs from "fs";

/**
 * 递归查找文件/目录
 * @param {string} dir 起始目录
 * @param {string[]} targetFiles 目标文件名数组
 * @param {number} maxDepth 最大递归深度
 * @param {number} currentDepth 当前递归深度（初始调用时传0）
 * @returns {string|object} 找到文件返回文件路径 找到文件夹返回对象 保存文件夹路径与文件夹里的文件路径
 */

export function findFileOrDirWithDepthLimit(
  dir,
  targetNames, // 可以是文件名或目录名
  maxDepth,
  currentDepth = 0
) {
  if (currentDepth > maxDepth) return null;

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    console.log("错误:" + e);
    return null;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // 如果找到目标文件，返回文件路径
    if (entry.isFile() && targetNames.includes(entry.name)) {
      return fullPath;
    }

    // 如果找到目标目录，返回包含目录路径和文件列表的对象
    if (entry.isDirectory() && targetNames.includes(entry.name)) {
      const files = fs
        .readdirSync(fullPath)
        .map((file) => path.join(fullPath, file));
      return {
        path: fullPath,
        files: files,
      };
    }
  }

  // 没找到就递归子目录
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const fullPath = path.join(dir, entry.name);
      const found = findFileOrDirWithDepthLimit(
        fullPath,
        targetNames,
        maxDepth,
        currentDepth + 1
      );
      if (found) return found;
    }
  }

  return null;
}

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

function copyInjectScriptToGame(gameDir, file) {
  try {
    // 1. 获取当前应用路径
    const appPath = app.isPackaged
      ? path.join(process.resourcesPath, "app") // 打包后的路径
      : app.getAppPath(); // dev 模式路径
    console.log("appPath", appPath);
    // 2. 源文件路径
    const sourceFile = path.join(appPath, "inject", file);
    console.log("sourceFile", sourceFile);
    // 3. 目标文件路径
    const jsDir = path.join(gameDir, "www", "js");
    const indexPath = fs.existsSync(jsDir) ? jsDir : path.join(gameDir, "js");
    const targetFile = path.join(indexPath, file);
    console.log(indexPath, targetFile);

    // 4. 复制文件r
    fs.copyFileSync(sourceFile, targetFile);

    console.log(`已复制 inject 脚本到游戏目录: ${targetFile}`);
  } catch (error) {
    console.error(error.msg);
  }
}

// 注入脚本到 index.html 中
export async function injectMVMZ(gameDir) {
  // 寻找 www 文件夹，如果有则使用其中的 index.html
  console.log("注入开始");
  const cheatJs = findFileOrDirWithDepthLimit(gameDir, ["cheatApi.js"], 3);
  const translatorJs = findFileOrDirWithDepthLimit(gameDir, ["cheatApi.js"], 3);

  console.log(cheatJs);
  if (!cheatJs && !translatorJs) {
    copyInjectScriptToGame(gameDir, "cheat.js");
    copyInjectScriptToGame(gameDir, "translator.js");
  }
  const jsDir = path.join(gameDir, "www", "index.html");
  // const jsDir = findFileOrDirWithDepthLimit(gameDir, ["index.html"], 3);

  const indexPath = fs.existsSync(jsDir)
    ? jsDir
    : path.join(gameDir, "index.html");
  const backupPath = indexPath + ".bak";

  if (!fs.existsSync(indexPath)) {
    console.error("无法找到 index.html 文件");
    return;
  }
  try {
    // 检查是否已经注入过脚本，避免重复注入
    const originalHtml = fs.readFileSync(indexPath, "utf-8");
    if (
      originalHtml.includes(
        '<script type="text/javascript" src="js/cheat.js"></script>'
      )
    ) {
      console.log("脚本已加载，跳过注入");
      return; // 如果已经有 cheatApi.js 脚本，则跳过注入
    }

    // 备份原始 index.html 文件
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(indexPath, backupPath);
    }

    // 准备注入的 script 标签
    const ScriptTag = `<script type="text/javascript" src="js/cheat.js"></script>
    <script type="text/javascript" src="js/translator.js"></script>`;

    // 在最后一个 <script> 标签之后插入 cheatApi.js
    const injectedHtml = originalHtml.replace(
      /<\/body>/i,
      `${ScriptTag}\n</body>` // 插入到 </body> 标签之前
    );

    // 将修改后的 HTML 写回
    fs.writeFileSync(indexPath, injectedHtml);
    console.log("脚本已注入");
  } catch (error) {
    console.error("注入失败:" + error);
  }
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
