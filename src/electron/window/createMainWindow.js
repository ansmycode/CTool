/**
创建 BrowserWindow
配置 preload
区分 Vite 开发地址与生产文件
*/

import { app, BrowserWindow } from "electron";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const preloadPath = path.join(__dirname, "..", "preload.js");

export function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1020,
    height: 680,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "CatTool",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (app.isPackaged) {
    mainWindow.loadFile(
      path.join(app.getAppPath(), "dist-react", "index.html"),
    );
  } else {
    mainWindow.loadURL("http://127.0.0.1:5173");
  }

  return mainWindow;
}
