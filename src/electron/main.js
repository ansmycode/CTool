import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import {
  detectAndReadInfo,
  restoreOriginalHtml,
  deleteBackupFile,
} from "../utils/gameUtil.js";
import {
  injectMVMZ,
} from "../engine/mvmz/injectScript.js";
import {
  readGameHistory,
  saveGameHistory,
  deleteGameHistory,
  findFileOrDirWithDepthLimit
} from "../utils/tool.js";
import { ExtractText, backup, replaceFromObject } from "../engine/mvmz/extract.js"
import { createServer } from '../electron/server.js';
// import { getGameData } from "../service/mvmzApi.ts";

let mainWindow;
let gameProcess = null;
let isGameStarting = false;
let gameInfo;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = process.cwd(); // 你的 exe 所在目录（打包后）
// 或者用 path.dirname(app.getPath("exe"))

// 必要资源配置
const essentials = [
  {
    type: "dir",
    path: path.join(appRoot, "tool_data"),
  },
  {
    type: "file",
    path: path.join(appRoot, "tool_data", "gameHistory.json"),
    defaultContent: JSON.stringify([], null, 2),
  },
  {
    type: "dir",
    path: path.join(appRoot, "loaders"),
  },
  {
    type: "dir",
    path: path.join(appRoot, "images"),
  },
];

// 启动时检查必要目录
function ensureEssentialDirs(essentials) {
  for (const item of essentials) {
    if (item.type === "dir") {
      if (!fs.existsSync(item.path)) {
        fs.mkdirSync(item.path, { recursive: true });
        console.log("已创建目录:", item.path);
      }
    } else if (item.type === "file") {
      if (!fs.existsSync(item.path)) {
        fs.writeFileSync(item.path, item.defaultContent || "", "utf-8");
        console.log("已创建文件:", item.path);
      }
    }
  }
}

// 启动游戏
function launchGame(gameInfo) {
  // 启动游戏进程
  gameProcess = spawn(gameInfo.gamePath, { detached: true });
  console.log(gameInfo);
  saveGameHistory(gameInfo);
  // 监听游戏进程是否关闭
  gameProcess.on("exit", (code, signal) => {
    console.log(`游戏已关闭，恢复原始 index.html 文件。`);
    restoreOriginalHtml(path.dirname(gameInfo.gamePath)); // 恢复原始 HTML
    deleteBackupFile(path.dirname(gameInfo.gamePath)); //删除备份文件
    mainWindow.webContents.send("game-closed", {
      message: "游戏进程未找到或已经关闭！",
      isGameStarting: false,
    });
    clearGame();
  });
}

//清除掉一些游戏数据
function clearGame() {
  gameProcess = null;
  isGameStarting = false;
  gameInfo = null;
}

app.on("ready", () => {
  ensureEssentialDirs(essentials);
  mainWindow = new BrowserWindow({
    width: 1020,
    height: 680,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "CatTool",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // mainWindow.setMenu(null); //关闭原始自带的菜单
  mainWindow.loadFile(path.join(app.getAppPath(), "dist-react", "index.html"));
  createServer(mainWindow);
});


// 选择游戏
ipcMain.handle("choose-game", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [{ name: "Executable", extensions: ["exe"] }],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const gamePath = result.filePaths[0];
    return gamePath;
  } else {
    return null;
  }
});
// 游戏基本信息判断
ipcMain.handle("detect-engine", async (_event, exePath) => {
  gameInfo = detectAndReadInfo(exePath);
  return gameInfo;
});

// MV / MZ 注入script
ipcMain.handle("inject-script", async (_event, gameInfo) => {
  try {
    await injectMVMZ(path.dirname(gameInfo.gamePath));
    launchGame(gameInfo); //使用子线程开启游戏
    return true;
  } catch (error) {
    console.error(error);
  }
});

// 其他游戏引擎注入
ipcMain.handle("inject-other", async (_event, gamePath) => { });

// 提取文本
ipcMain.handle("apply-filters", async (_event, { gameInfo }) => {
  if (!gameInfo.gamePath || !gameInfo.engine) return;
  if (gameInfo.engine === "MV" || gameInfo.engine === "MZ") {
    const gameDir = path.dirname(gameInfo.gamePath);
    try {
      const results = await ExtractText(gameDir);
      return results;
    } catch (err) {
      return err.message;
    }
  }
});

// 保存提取文本
ipcMain.handle("save-translate-file", async (_event, { textArr, gameInfo }) => {
  if (!textArr.length > 0) return;
  const gameDir = path.dirname(gameInfo.gamePath);
  const outputPath = path.join(gameDir, "CatToolTranslate.json");
  const textJson = {};
  textArr.forEach((item) => (textJson[item] = item));
  try {
    fs.writeFileSync(outputPath, JSON.stringify(textJson, null, 2), "utf-8");
  } catch (e) {
    console.error("写入翻译文件失败:", e);
  }
});



// 内嵌翻译
ipcMain.handle("built-in-translation", async (event, { gamePath, engine }) => {
  if (!gamePath || !engine) return;
  if (engine === "MV" || engine === "MZ") {
    const gameDir = path.dirname(gamePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-"); // 2025-08-24T12-34-56-789Z
    const backupName = `data_backup_${timestamp}.zip`;
    //读取文件
    const chooseFile = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [{ name: "JSON Files", extensions: ["json"] }],
    });
    if (!chooseFile) return;
    //备份 data 文件夹
    try {
      event.sender.send("builtin-status", { status: "backup" });
      const target = ["data"];
      const found = findFileOrDirWithDepthLimit(gameDir, target, 3);
      const backupFile = await backup(
        found.path,
        path.join(gameDir, backupName)
      );
      console.log(`备份完成：${backupFile}`);
      event.sender.send("builtin-status", { status: "backupend" });
      // 3. 开始替换数据

      let translationData = JSON.parse(
        fs.readFileSync(chooseFile.filePaths[0], "utf-8")
      );
      let process = 0;
      found.files.forEach((file) => {
        if (file.endsWith(".json")) {
          let content = JSON.parse(fs.readFileSync(file, "utf-8"));

          // 对每个文件进行字段替换
          if (Array.isArray(content)) {
            content = content.map((item) =>
              replaceFromObject(item, translationData)
            ); // 创建新数组
          } else {
            // 兼容个别是对象的文件
            content = replaceFromObject(content, translationData); // 直接替换
          }
          // 保存文件
          fs.writeFileSync(file, JSON.stringify(content, null, 2));
          process++;
          event.sender.send("builtin-status", {
            status: "builting",
            data: { current: process, total: found.length },
          });
        }
      });
      event.sender.send("builtin-status", {
        status: "done",
      });
      return { status: "success", message: "翻译完成，文件已替换。" };
    } catch (err) {
      console.error("翻译失败:", err);
      event.sender.send("builtin-status", {
        status: "error",
        message: err.message,
      });
    }
  }
});

// 加载翻译json
ipcMain.handle("load-json", async (_event) => {
  //读取文件
  const chooseFile = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [{ name: "JSON Files", extensions: ["json"] }],
  });
  if (!chooseFile.filePaths[0]) return;
  let translationData = JSON.parse(
    fs.readFileSync(chooseFile.filePaths[0], "utf-8")
  );
  return translationData;
});

// 读取游玩历史
ipcMain.handle("read-game-history", async (_event) => {
  try {
    const gameHistory = readGameHistory();
    return gameHistory;
  } catch (error) {
    console.error(error);
  }
});

// 打开游戏所在目录
ipcMain.handle("open-game-dir", async (_event, gamePath) => {
  try {
    const dir = path.dirname(gamePath);
    if (dir) {
      shell.openPath(dir);
      return { success: true };
    } else {
      return { success: false, message: "游戏不存在" };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// 删除游戏历史记录
ipcMain.handle("delete-game-history", async (_event, gamePath) => {
  const result = deleteGameHistory(gamePath);
  return result;
});
