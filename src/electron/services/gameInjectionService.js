/**
注入游戏脚本
启动游戏进程
保存历史记录
监听游戏退出
发送 game-closed
 */

import path from "path";
import { spawn } from "child_process";
import { injectMVMZ } from "../../engine/mvmz/injectScript.js";
import { deleteBackupFile } from "../../utils/gameUtil.js";
import { saveHistory } from "./gameHistoryService.js";

export function createGameInjectionService(getMainWindow) {
  let gameProcess = null;
  let gameInfo = null;

  function clearGame() {
    gameProcess = null;
    gameInfo = null;
  }

  function launchGame(nextGameInfo) {
    gameInfo = nextGameInfo;
    gameProcess = spawn(gameInfo.gamePath, { detached: true });
    console.log(gameInfo);
    saveHistory(gameInfo);

    gameProcess.on("exit", () => {
      console.log("游戏已关闭，恢复原始 index.html 文件。");
      deleteBackupFile(path.dirname(gameInfo.gamePath));
      getMainWindow()?.webContents.send("game-closed", {
        message: "游戏进程未找到或已经关闭！",
        isGameStarting: false,
      });
      clearGame();
    });
  }

  async function injectAndLaunch(nextGameInfo) {
    try {
      await injectMVMZ(path.dirname(nextGameInfo.gamePath));
      launchGame(nextGameInfo);
      return true;
    } catch (error) {
      console.error(error);
    }
  }

  return {
    injectAndLaunch,
  };
}
