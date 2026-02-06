const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  detectEngine: (exePath) => ipcRenderer.invoke("detect-engine", exePath), //判断游戏引擎
  injectScript: (gameInfo) => ipcRenderer.invoke("inject-script", gameInfo), //mv/mz注入脚本操作
  injectOther: (gamePath) => ipcRenderer.invoke("inject-other", gamePath), //其他引擎注入脚本操作
  getRpgmvmzData: () => ipcRenderer.invoke("get-rpgmvmz-data"), //其他引擎注入脚本操作
  chooseGame: () => ipcRenderer.invoke("choose-game"), //选择游戏
  sendMessage: (channel, message) => ipcRenderer.send(channel, message), // 渲染 ===> 主
  onReceiveMessage: (channel, callback) => ipcRenderer.on(channel, callback), //主 ===> 渲染
  applyFilters: ({ gameInfo, rules }) =>
    ipcRenderer.invoke("apply-filters", { gameInfo, rules }),
  saveTranslateFile: ({ textArr, gameInfo }) =>
    ipcRenderer.invoke("save-translate-file", { textArr, gameInfo }),
  onExtractStatus: (callback) =>
    ipcRenderer.on("extract-status", (_, status) => callback(status)),
  onBuiltInStatus: (callback) =>
    ipcRenderer.on("builtin-status", (_, status) => callback(status)),
  builtInTranslation: ({ gamePath, engine }) =>
    ipcRenderer.invoke("built-in-translation", { gamePath, engine }), //选择游戏
  loadJson: () => ipcRenderer.invoke("load-json"), //加载翻译文件
  readGameHistory: () => ipcRenderer.invoke("read-game-history"), //读取历史游玩
  openGameDir: (gamePath) => ipcRenderer.invoke("open-game-dir", gamePath), //打开游戏所在目录
  deleteGameHistory: (gamePath) =>
    ipcRenderer.invoke("delete-game-history", gamePath), //删除游戏历史
  test: () => ipcRenderer.invoke("test"),
});
