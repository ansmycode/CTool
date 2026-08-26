/**
集中注册所有 IPC
负责 Electron 对话框和打开目录等平台 API
将实际业务转交给服务层
 */

import { dialog, ipcMain } from "electron";
import { detectGame } from "../services/gameDetectionService.js";
import { deleteHistory, readHistory } from "../services/gameHistoryService.js";
import {
  extractGameText,
  processBuiltInTranslation,
  readTranslationJson,
  saveTranslationFile,
} from "../services/translationService.js";
import {
  inspectAITranslationSource,
  prepareAITranslationWorkFile,
} from "../ai/workFile.js";
import { testAIProviderConnection } from "../ai/providerClient.js";
import { runAITranslation } from "../ai/translator.js";
import { runExclusiveAITranslation } from "../ai/taskRegistry.js";
import {
  createGameDataBackup,
  listGameDataBackups,
  restoreGameDataBackup,
} from "../services/gameDataBackupService.js";
import { openPathInFileManager } from "../services/fileManagerService.js";

function safeAIError(error, fallback) {
  return new Error(error instanceof Error ? error.message : fallback);
}

export function registerIpcHandlers({
  getMainWindow,
  gameInjectionService,
  globalShortcutService,
}) {
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
    async (event, { gamePath, engine, currentBackupPath }) => {
      if (!gamePath || !engine) return;

      const chooseFile = await dialog.showOpenDialog(getMainWindow(), {
        properties: ["openFile"],
        filters: [{ name: "JSON Files", extensions: ["json"] }],
      });
      const translationFilePath = chooseFile.filePaths[0];
      if (chooseFile.canceled || !translationFilePath) return null;

      return processBuiltInTranslation(
        event,
        translationFilePath,
        { gamePath, engine },
        currentBackupPath,
      );
    },
  );

  ipcMain.handle("built-in:list-backups", async (_event, gameInfo) => {
    return listGameDataBackups(gameInfo);
  });

  ipcMain.handle("built-in:create-backup", async (event, gameInfo) => {
    return createGameDataBackup(gameInfo, event);
  });

  ipcMain.handle(
    "built-in:restore-backup",
    async (event, { gameInfo, backupPath }) => {
      return restoreGameDataBackup(gameInfo, backupPath, event);
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

  ipcMain.handle("ai-translation:select-source", async () => {
    const chooseFile = await dialog.showOpenDialog(getMainWindow(), {
      properties: ["openFile"],
      filters: [{ name: "JSON Files", extensions: ["json"] }],
    });
    const sourcePath = chooseFile.filePaths[0];
    if (chooseFile.canceled || !sourcePath) return null;

    try {
      return inspectAITranslationSource(sourcePath);
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "无法读取原始翻译 JSON。",
      );
    }
  });

  ipcMain.handle("ai-translation:prepare-work-file", async (_event, sourcePath) => {
    if (typeof sourcePath !== "string" || sourcePath.length === 0) {
      throw new Error("缺少原始翻译 JSON 路径。");
    }
    try {
      return prepareAITranslationWorkFile(sourcePath);
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "无法创建 AI 翻译工作文件。",
      );
    }
  });

  ipcMain.handle("ai-translation:test-connection", async (_event, config) => {
    try {
      return await testAIProviderConnection(config);
    } catch (error) {
      throw safeAIError(error, "AI 服务连接测试失败。");
    }
  });

  ipcMain.handle(
    "ai-translation:start",
    async (_event, { sourcePath, config }) => {
      if (typeof sourcePath !== "string" || sourcePath.length === 0) {
        throw new Error("缺少原始翻译 JSON 路径。");
      }
      try {
        return await runExclusiveAITranslation(sourcePath, () =>
          runAITranslation(sourcePath, config),
        );
      } catch (error) {
        throw safeAIError(error, "AI 翻译失败。");
      }
    },
  );

  ipcMain.handle("read-game-history", async () => {
    try {
      return readHistory();
    } catch (error) {
      console.error(error);
    }
  });

  ipcMain.handle("open-path-in-file-manager", async (_event, targetPath) => {
    return openPathInFileManager(targetPath);
  });

  ipcMain.handle("delete-game-history", async (_event, gamePath) => {
    return deleteHistory(gamePath);
  });

  ipcMain.handle("shortcuts:update", async (_event, bindings) => {
    if (!Array.isArray(bindings)) {
      throw new Error("快捷键配置格式无效");
    }

    return globalShortcutService.update(bindings.slice(0, 50));
  });
}
