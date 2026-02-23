import path from "path";
import fs from "fs";
const toolDataDir = path.join(process.cwd(), "tool_data");
const historyFile = path.join(toolDataDir, "gameHistory.json");
// 读取历史游玩记录 JSON 文件，若文件不存在则创建并保存默认记录
export function readGameHistory() {
  if (fs.existsSync(historyFile)) {
    // 如果文件存在，读取内容并解析为 JSON
    const fileContent = fs.readFileSync(historyFile, "utf8");
    return JSON.parse(fileContent);
  }
}

// 保存新的游戏历史记录到 JSON 文件
export function saveGameHistory(newHistory) {
  // 先读取旧的记录
  const currentHistory = readGameHistory();
  const index = currentHistory.findIndex(
    (item) => item.gamePath === newHistory.gamePath
  );
  if (index >= 0) {
    // 更新已有记录的最后游玩时间以及其他需要更新的信息
    currentHistory[index] = {
      ...newHistory,
      lastPlayed: formatDate(new Date()),
    };
  } else {
    // 新增记录
    currentHistory.push({
      ...newHistory,
      firstPlayed: formatDate(new Date()),
      lastPlayed: formatDate(new Date()),
    });
  }

  // 将更新后的历史记录写入文件
  fs.writeFileSync(
    historyFile,
    JSON.stringify(currentHistory, null, 2),
    "utf8"
  );
}

//删除游戏历史记录(单条)
export function deleteGameHistory(needDeletePath) {
  try {
    const currentHistory = readGameHistory();
    const filterHistory = currentHistory.filter(
      (item) => item.gamePath !== needDeletePath
    );
    console.log("filterHistory", filterHistory);
    // 将更新后的历史记录写入文件
    fs.writeFileSync(
      historyFile,
      JSON.stringify(filterHistory, null, 2),
      "utf8"
    );
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

//日期格式过滤
function formatDate(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}/${m}/${d} ${hh}:${mm}:${ss}`;
}

//备份
export async function backupDataFolder(gameDir, event) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupName = `data_backup_${timestamp}.zip`;

  const target = ["data"];
  const found = findFileOrDirWithDepthLimit(gameDir, target, 3);

  if (!found?.path) {
    throw new Error("未找到 data 文件夹");
  }

  event?.sender?.send("builtin-status", { status: "backup" });

  const backupFile = await backup(
    found.path,
    path.join(gameDir, backupName)
  );

  event?.sender?.send("builtin-status", { status: "backupend" });

  return {
    backupFile,
    dataPath: found.path,
    files: found.files,
  };
}

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
