const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  detectEngine: (exePath) => ipcRenderer.invoke('detect-engine', exePath), //判断游戏引擎
  injectScript: (gamePath) => ipcRenderer.invoke('inject-script', gamePath), //mv/mz注入脚本操作
  injectOther: (gamePath) => ipcRenderer.invoke('inject-other', gamePath), //其他引擎注入脚本操作
  getRpgmvmzData: () => ipcRenderer.invoke('get-rpgmvmz-data'), //其他引擎注入脚本操作
  chooseGame: () => ipcRenderer.invoke('choose-game'), //选择游戏
  sendMessage: (channel, message) => ipcRenderer.send(channel, message), // 渲染 ===> 主
  onReceiveMessage: (channel, callback) => ipcRenderer.on(channel, callback) //主 ===> 渲染
  
});
