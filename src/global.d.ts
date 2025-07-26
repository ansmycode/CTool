declare global {
  interface Window {
    electronAPI: {
      detectEngine: (exePath: string) => Promise<{ engine: string, path: string }>;
      injectAndLaunch: (gameDir: string) => Promise<boolean>;
    };
  }
}