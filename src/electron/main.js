import { app } from "electron";
import { registerIpcHandlers } from "./ipc/registerIpcHandlers.js";
import { createServer } from "./server.js";
import { ensureEssentialResources } from "./services/appResourceService.js";
import { createGameInjectionService } from "./services/gameInjectionService.js";
import { createMainWindow } from "./window/createMainWindow.js";

let mainWindow;
const getMainWindow = () => mainWindow;
const gameInjectionService = createGameInjectionService(getMainWindow);

registerIpcHandlers({
  getMainWindow,
  gameInjectionService,
});

app.whenReady().then(() => {
  ensureEssentialResources();
  mainWindow = createMainWindow();
  createServer(mainWindow);
});
