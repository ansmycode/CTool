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

function formatDate(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}/${m}/${d} ${hh}:${mm}:${ss}`;
}
