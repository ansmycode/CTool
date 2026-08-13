/**
创建 BrowserWindow
配置 preload
区分 Vite 开发地址与生产文件
*/

import { app, BrowserWindow, screen } from "electron";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const preloadPath = path.join(__dirname, "..", "preload.js");
const iconPath = path.join(app.getAppPath(), "logo.png");

const BASE_WINDOW_WIDTH = 1080;
const BASE_WINDOW_HEIGHT = 720;
const MAX_WINDOW_SCALE = 1.12;

function getAdaptiveWindowSize() {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { width: workWidth, height: workHeight } = display.workAreaSize;
  const scale = Math.min(
    (workWidth * 0.82) / BASE_WINDOW_WIDTH,
    (workHeight * 0.86) / BASE_WINDOW_HEIGHT,
    MAX_WINDOW_SCALE,
  );

  return {
    width: Math.round(BASE_WINDOW_WIDTH * scale),
    height: Math.round(BASE_WINDOW_HEIGHT * scale),
  };
}

export function createMainWindow() {
  const windowSize = getAdaptiveWindowSize();
  const mainWindow = new BrowserWindow({
    ...windowSize,
    center: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "CatTool",
    icon: iconPath,
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
