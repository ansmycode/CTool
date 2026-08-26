export {};

import type {
  AITranslationFileSelection,
  AITranslationPreparation,
  AITranslationAPIConfig,
  AIConnectionTestResult,
} from "@/types/AITranslation";

declare global {
  interface BuiltInBackupInfo {
    filePath: string;
    fileName: string;
    createdAt: string;
    displayTime: string;
    size: number;
    legacy: boolean;
  }

  interface BuiltInBackupList {
    backupDirectory: string;
    backups: BuiltInBackupInfo[];
  }

  interface Window {
    electronAPI: {
      applyFilters: (args: { gameInfo: any }) => Promise<void>;
      saveTranslateFile: (args: {
        textArr: string[];
        gameInfo: any;
      }) => Promise<void>;
      onExtractStatus: (callback: (status: any) => void) => () => void;
      onBuiltInStatus: (callback: (status: any) => void) => () => void;
      builtInTranslation: (args: {
        gamePath: string | null;
        engine: string | null;
        currentBackupPath?: string | null;
      }) => Promise<{ status: string; message: string } | null>;
      listBuiltInBackups: (gameInfo: {
        gamePath: string;
        engine: string;
      }) => Promise<BuiltInBackupList>;
      createBuiltInBackup: (gameInfo: {
        gamePath: string;
        engine: string;
      }) => Promise<{
        backupDirectory: string;
        backup: BuiltInBackupInfo;
      }>;
      restoreBuiltInBackup: (
        gameInfo: { gamePath: string; engine: string },
        backupPath: string,
      ) => Promise<{ success: boolean; backupPath: string }>;
      loadJson: () => Promise<void>;
      selectAITranslationJson: () => Promise<AITranslationFileSelection | null>;
      prepareAITranslationWorkFile: (
        sourcePath: string,
      ) => Promise<AITranslationPreparation>;
      testAITranslationConnection: (
        config: AITranslationAPIConfig,
      ) => Promise<AIConnectionTestResult>;
      startAITranslation: (
        sourcePath: string,
        config: AITranslationAPIConfig,
      ) => Promise<AITranslationPreparation>;
      readGameHistory: () => Promise<any[]>;
      openPathInFileManager: (targetPath: string) => Promise<{
        success: boolean;
        path?: string;
        message?: string;
      }>;
      deleteGameHistory: (gamePath: string) => Promise<void>;
      updateGlobalShortcuts: (
        bindings: Array<{ actionId: string; accelerator: string }>,
      ) => Promise<Record<string, boolean>>;
      onReceiveMessage: (
        channel: string,
        callback: (event: unknown, data: any) => void,
      ) => () => void;
      test: () => Promise<void>;
    };
  }
}
