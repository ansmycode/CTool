// adapters/MVAdapter.ts
import type { GameEngineAdapter, GameData } from "@/types/Game";
import {
  getMVMZGameData,
  achieveVictory,
  callGainItem,
  setSwitches,
  setVariables,
  setGold,
  setInTeam,
  setActorData,
  sendTranslationData,
  setSomeGameSettings,
} from "../../service/mvmzApi";
import { MVMZ_SERVICE_URL } from "@/service/request";

/**
 * MV 引擎适配器
 * 使用 HTTP API 与注入的 cheatApi.js 通信
 */
export default class MVAdapter implements GameEngineAdapter {
  async init(retries = 5, interval = 300, timeout = 500): Promise<boolean> {
    const ping = async (): Promise<boolean> => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const res = await fetch(MVMZ_SERVICE_URL + "/ping", {
          signal: controller.signal,
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        clearTimeout(id);
      }
    };

    for (let i = 0; i < retries; i++) {
      if (await ping()) {
        return true; // 成功，通知 hook
      }
      await new Promise((r) => setTimeout(r, interval)); // 重试间隔
    }

    return false; // 全部失败，通知 hook
  }

  async getData(): Promise<GameData> {
    const res = await getMVMZGameData();
    return res.data;
  }

  async setGameGold(amount: number): Promise<void> {
    await setGold(amount);
  }

  async modifyVariables(id: number, value: string | number): Promise<void> {
    await setVariables(id, value);
  }

  async modifySwitches(id: number, value: boolean): Promise<void> {
    await setSwitches(id, value);
  }

  async gainItems(id: number, count: number, gainType: string): Promise<void> {
    await callGainItem(id, count, gainType);
  }

  async setInTeam(ids: Array<number>): Promise<void> {
    await setInTeam(ids);
  }

  async setActorData(actor: any): Promise<void> {
    await setActorData(actor);
  }

  async sendTranslationData(translated: any): Promise<void> {
    await sendTranslationData(translated);
  }

  async achieveVictory(): Promise<void> {
    await achieveVictory();
  }

  async setSomeGameSettings(type: string, value: any): Promise<void> {
    await setSomeGameSettings(type, value);
  }
}
