const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  detectEngine: (exePath) => ipcRenderer.invoke("detect-engine", exePath), //判断游戏引擎
  injectScript: (gameInfo) => ipcRenderer.invoke("inject-script", gameInfo), //mv/mz注入脚本操作
  injectOther: (gamePath) => ipcRenderer.invoke("inject-other", gamePath), //其他引擎注入脚本操作
  getRpgmvmzData: () => ipcRenderer.invoke("get-rpgmvmz-data"), //其他引擎注入脚本操作
  chooseGame: () => ipcRenderer.invoke("choose-game"), //选择游戏
  sendMessage: (channel, message) => ipcRenderer.send(channel, message), // 渲染 ===> 主
  onReceiveMessage: (channel, callback) => {
    ipcRenderer.on(channel, callback);
    return () => {
      ipcRenderer.removeListener(channel, callback);
    };
  }, //主 ===> 渲染
  applyFilters: ({ gameInfo }) =>
    ipcRenderer.invoke("apply-filters", { gameInfo }),
  saveTranslateFile: ({ textArr, gameInfo }) =>
    ipcRenderer.invoke("save-translate-file", { textArr, gameInfo }),
  onExtractStatus: (callback) => {
    const listener = (_, status) => callback(status);
    ipcRenderer.on("extract-status", listener);
    return () => {
      ipcRenderer.removeListener("extract-status", listener);
    };
  },
  onBuiltInStatus: (callback) => {
    const listener = (_, status) => callback(status);
    ipcRenderer.on("builtin-status", listener);
    return () => {
      ipcRenderer.removeListener("builtin-status", listener);
    };
  },
  builtInTranslation: ({ gamePath, engine, currentBackupPath }) =>
    ipcRenderer.invoke("built-in-translation", {
      gamePath,
      engine,
      currentBackupPath,
    }),
  listBuiltInBackups: (gameInfo) =>
    ipcRenderer.invoke("built-in:list-backups", gameInfo),
  createBuiltInBackup: (gameInfo) =>
    ipcRenderer.invoke("built-in:create-backup", gameInfo),
  restoreBuiltInBackup: (gameInfo, backupPath) =>
    ipcRenderer.invoke("built-in:restore-backup", { gameInfo, backupPath }),
  loadJson: () => ipcRenderer.invoke("load-json"), //加载翻译文件
  selectAITranslationJson: () =>
    ipcRenderer.invoke("ai-translation:select-source"),
  prepareAITranslationWorkFile: (sourcePath) =>
    ipcRenderer.invoke("ai-translation:prepare-work-file", sourcePath),
  testAITranslationConnection: (config) =>
    ipcRenderer.invoke("ai-translation:test-connection", config),
  startAITranslation: (sourcePath, config) =>
    ipcRenderer.invoke("ai-translation:start", { sourcePath, config }),
  readGameHistory: () => ipcRenderer.invoke("read-game-history"), //读取历史游玩
  openPathInFileManager: (targetPath) =>
    ipcRenderer.invoke("open-path-in-file-manager", targetPath),
  deleteGameHistory: (gamePath) =>
    ipcRenderer.invoke("delete-game-history", gamePath), //删除游戏历史
  updateGlobalShortcuts: (bindings) =>
    ipcRenderer.invoke("shortcuts:update", bindings),
  test: () => ipcRenderer.invoke("test"),
});
