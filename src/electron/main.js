import { app } from "electron";
import { registerIpcHandlers } from "./ipc/registerIpcHandlers.js";
import { createServer } from "./server.js";
import { ensureEssentialResources } from "./services/appResourceService.js";
import { createGameInjectionService } from "./services/gameInjectionService.js";
import { createGlobalShortcutService } from "./services/globalShortcutService.js";
import { createMainWindow } from "./window/createMainWindow.js";

let mainWindow;
const getMainWindow = () => mainWindow;
const gameInjectionService = createGameInjectionService(getMainWindow);
const globalShortcutService = createGlobalShortcutService(getMainWindow);

registerIpcHandlers({
  getMainWindow,
  gameInjectionService,
  globalShortcutService,
});

app.on("will-quit", () => {
  globalShortcutService.clear();
});

app.whenReady().then(() => {
  ensureEssentialResources();
  mainWindow = createMainWindow();
  createServer(mainWindow);
});
