/**
 * 注入游戏插件、启动游戏进程、保存历史记录，并在游戏退出后清理本次注入。
 */
import path from "path";
import { spawn } from "child_process";
import {
  cleanupMVMZInjection,
  injectMVMZ,
} from "../../engine/mvmz/injectScript.js";
import { saveHistory } from "./gameHistoryService.js";

export function createGameInjectionService(getMainWindow) {
  let gameProcess = null;
  let gameInfo = null;
  let injectionSession = null;

  function clearGame() {
    gameProcess = null;
    gameInfo = null;
    injectionSession = null;
  }

  async function cleanupInjection() {
    if (!injectionSession) return;
    try {
      await cleanupMVMZInjection(injectionSession);
      console.log("CTool 插件注入已清理。");
    } catch (error) {
      console.error("清理 CTool 插件注入失败：", error);
    }
  }

  function notifyGameClosed() {
    getMainWindow()?.webContents.send("game-closed", {
      message: "游戏进程未找到或已经关闭。",
      isGameStarting: false,
    });
  }

  function launchGame(nextGameInfo) {
    gameInfo = nextGameInfo;
    gameProcess = spawn(gameInfo.gamePath, { detached: true });
    saveHistory(gameInfo);

    gameProcess.once("error", async (error) => {
      console.error("游戏启动失败：", error);
      await cleanupInjection();
      notifyGameClosed();
      clearGame();
    });

    gameProcess.once("exit", async () => {
      console.log("游戏已关闭，开始清理 CTool 插件注入。");
      await cleanupInjection();
      notifyGameClosed();
      clearGame();
    });
  }

  async function injectAndLaunch(nextGameInfo) {
    try {
      injectionSession = await injectMVMZ(path.dirname(nextGameInfo.gamePath));
      launchGame(nextGameInfo);
      return true;
    } catch (error) {
      console.error("注入或启动游戏失败：", error);
      await cleanupInjection();
      clearGame();
      throw error;
    }
  }

  return { injectAndLaunch };
}
