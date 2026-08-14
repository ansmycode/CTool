export {};

import type {
  AITranslationFileSelection,
  AITranslationPreparation,
  AITranslationAPIConfig,
  AIConnectionTestResult,
} from "@/types/AITranslation";

declare global {
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
      }) => Promise<void>;
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
      openGameDir: (gamePath: string) => Promise<void>;
      deleteGameHistory: (gamePath: string) => Promise<void>;
      onReceiveMessage: (
        channel: string,
        callback: (event: unknown, data: any) => void,
      ) => () => void;
      test: () => Promise<void>;
    };
  }
}
