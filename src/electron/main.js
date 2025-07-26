import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { spawn } from "child_process";
import { fileURLToPath } from 'url';
import { detectEngine, injectAndLaunch, restoreOriginalHtml, deleteBackupFile } from "../utils/gameUtil.js";
import { getGameData } from "../service/mvmzApi.js";

let mainWindow;
let gameProcess = null;
let isGameStarting = false
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 启动游戏
function launchGame(gamePath) {
  const exePath = gamePath; // 游戏路径
  // 启动游戏进程
  gameProcess = spawn(exePath, { detached: true });
  // 监听游戏进程是否关闭
  gameProcess.on('exit', (code, signal) => {
    console.log(`游戏已关闭，恢复原始 index.html 文件。`);
    restoreOriginalHtml(path.dirname(gamePath)); // 恢复原始 HTML
    deleteBackupFile(path.dirname(gamePath))  //删除备份文件
    mainWindow.webContents.send('game-closed', '游戏进程未找到或已经关闭！');
    clearGame()
  });
}

//清除掉一些游戏数据 
function clearGame() {
  gameProcess = null
  isGameStarting = false
}


app.on("ready", () => {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.setMenu(null); //关闭原始自带的菜单
  mainWindow.loadFile(path.join(app.getAppPath(), 'dist-react', 'index.html'));
});

// IPC 接口
ipcMain.handle('choose-game', async () => {
  console.log("大大大大大大")
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Executable', extensions: ['exe'] }],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const gamePath = result.filePaths[0];
    return gamePath;
  } else {
    return null;
  }
});
// 引擎判断
ipcMain.handle('detect-engine', async (_event, exePath) => {
  return detectEngine(path.dirname(exePath));
});

// MV / MZ 注入script
ipcMain.handle('inject-script', async (_event, gamePath) => {
  try {
    await injectAndLaunch(path.dirname(gamePath));
    launchGame(gamePath) //使用子线程开启游戏
    return true
  } catch (error) {
    console.error(error)
  }

});

// 其他游戏引擎注入
ipcMain.handle('inject-other', async (_event, gamePath) => {

});

// 其他游戏引擎注入
ipcMain.handle('get-rpgmvmz-data', async (_event) => {
  try {
    const mvMzRpgData = await getGameData()
    return mvMzRpgData
  } catch (error) {
    console.error(error)
  }
});
