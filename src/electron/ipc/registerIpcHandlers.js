/**
集中注册所有 IPC
负责 Electron 对话框和打开目录等平台 API
将实际业务转交给服务层
 */

import { dialog, ipcMain, shell } from "electron";
import path from "path";
import { detectGame } from "../services/gameDetectionService.js";
import { deleteHistory, readHistory } from "../services/gameHistoryService.js";
import {
  extractGameText,
  processBuiltInTranslation,
  readTranslationJson,
  saveTranslationFile,
} from "../services/translationService.js";

export function registerIpcHandlers({ getMainWindow, gameInjectionService }) {
  ipcMain.handle("choose-game", async () => {
    const result = await dialog.showOpenDialog(getMainWindow(), {
      properties: ["openFile"],
      filters: [{ name: "Executable", extensions: ["exe"] }],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle("detect-engine", async (_event, exePath) => {
    return detectGame(exePath);
  });

  ipcMain.handle("inject-script", async (_event, gameInfo) => {
    return gameInjectionService.injectAndLaunch(gameInfo);
  });

  ipcMain.handle("inject-other", async () => {});

  ipcMain.handle("apply-filters", async (_event, { gameInfo }) => {
    return extractGameText(gameInfo);
  });

  ipcMain.handle(
    "save-translate-file",
    async (_event, { textArr, gameInfo }) => {
      return saveTranslationFile(textArr, gameInfo);
    },
  );

  ipcMain.handle(
    "built-in-translation",
    async (event, { gamePath, engine }) => {
      if (!gamePath || !engine) return;
      if (engine !== "MV" && engine !== "MZ") return;

      const chooseFile = await dialog.showOpenDialog(getMainWindow(), {
        properties: ["openFile"],
        filters: [{ name: "JSON Files", extensions: ["json"] }],
      });
      if (!chooseFile) return;

      return processBuiltInTranslation(event, chooseFile, gamePath);
    },
  );

  ipcMain.handle("load-json", async () => {
    const chooseFile = await dialog.showOpenDialog(getMainWindow(), {
      properties: ["openFile"],
      filters: [{ name: "JSON Files", extensions: ["json"] }],
    });
    if (!chooseFile.filePaths[0]) return;
    return readTranslationJson(chooseFile.filePaths[0]);
  });

  ipcMain.handle("read-game-history", async () => {
    try {
      return readHistory();
    } catch (error) {
      console.error(error);
    }
  });

  ipcMain.handle("open-game-dir", async (_event, gamePath) => {
    try {
      const dir = path.dirname(gamePath);
      if (dir) {
        shell.openPath(dir);
        return { success: true };
      }
      return { success: false, message: "游戏不存在" };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle("delete-game-history", async (_event, gamePath) => {
    return deleteHistory(gamePath);
  });
}
