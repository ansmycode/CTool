export {};

declare global {
  interface Window {
    electronAPI: {
      applyFilters: (args: { gameInfo: any; rules: any }) => Promise<void>;
      saveTranslateFile: (args: {
        textArr: string[];
        gameInfo: any;
      }) => Promise<void>;
      onExtractStatus: (callback: (status: any) => void) => void;
      onBuiltInStatus: (callback: (status: any) => void) => void;
      builtInTranslation: (args: {
        gamePath: string | null;
        engine: string | null;
      }) => Promise<void>;
      loadJson: () => Promise<void>;
      readGameHistory: () => Promise<void>;
      openGameDir: (gamePath: string) => Promise<void>;
      deleteGameHistory: (gamePath: string) => Promise<void>;
      test: () => Promise<void>;
    };
  }
}
