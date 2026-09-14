import { app } from "electron";
import { registerIpcHandlers } from "./ipc/registerIpcHandlers.js";
import { createServer } from "./server.js";
import { ensureEssentialResources } from "./services/appResourceService.js";
import { createGameSessionService } from "./services/gameSessionService.js";
import { createEngineDriver } from "./engines/registry.js";
import { detectGame } from "./services/gameDetectionService.js";
import { saveHistory } from "./services/gameHistoryService.js";
import { createGlobalShortcutService } from "./services/globalShortcutService.js";
import { createMainWindow } from "./window/createMainWindow.js";

let mainWindow;
const getMainWindow = () => mainWindow;
const gameSessionService = createGameSessionService({
  detect: detectGame, createDriver: createEngineDriver, saveHistory,
  publish: (snapshot) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("game-session-changed", snapshot);
      if (snapshot.state !== "ready") globalShortcutService.clear();
    }
  },
});
const globalShortcutService = createGlobalShortcutService(getMainWindow);

registerIpcHandlers({
  getMainWindow,
  gameSessionService,
  globalShortcutService,
});

app.on("will-quit", () => {
  globalShortcutService.clear();
  gameSessionService.dispose();
});

app.whenReady().then(() => {
  ensureEssentialResources();
  mainWindow = createMainWindow();
  createServer(() => gameSessionService.markMvmzReady());
});
