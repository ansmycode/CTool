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
import { createWolfTranslationPersistence } from './wolf/translationPersistence.js';

// Chromium's generic "Network service crashed" line omits the reason/code.
// Record only process metadata, never request URLs, headers or API keys.
app.on("child-process-gone", (_event, details) => {
  if (details.reason === "clean-exit") return;
  console.error("[electron:child-process-gone]", JSON.stringify({
    time: new Date().toISOString(),
    type: details.type,
    serviceName: details.serviceName,
    name: details.name,
    reason: details.reason,
    exitCode: details.exitCode,
    exitCodeHex: `0x${(details.exitCode >>> 0).toString(16).padStart(8, "0")}`,
    electron: process.versions.electron,
    chromium: process.versions.chrome,
    uptimeSeconds: Math.round(process.uptime()),
  }));
});

let mainWindow;
const getMainWindow = () => mainWindow;
const gameSessionService = createGameSessionService({
  detect: detectGame, createDriver: createEngineDriver, saveHistory,
  translationPersistence: createWolfTranslationPersistence(),
  publish: (snapshot) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("game-session-changed", snapshot);
      const shortcutsReady = snapshot.state === 'ready' || (snapshot.game?.engine === 'wolf' &&
        snapshot.state === 'degraded' && snapshot.runtimeAvailable && snapshot.processState === 'running');
      if (!shortcutsReady) globalShortcutService.clear();
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
