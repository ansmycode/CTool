import type {
  GameEngineAdapter,
  GameShortcutPolicy,
  GameShortcutActionId,
} from "@/game/types";
import type {
  GameFeatureDataMap,
  GameFeatureReaders,
} from "@/game/features";
import { get, MVMZ_SERVICE_URL, post } from "@/lib/http";

async function getFeatureData<K extends keyof GameFeatureDataMap>(
  endpoint: string,
): Promise<GameFeatureDataMap[K]> {
  const response = await get<GameFeatureDataMap[K]>(endpoint, {});
  return response.data as GameFeatureDataMap[K];
}

const features: GameFeatureReaders = {
  overview: {
    getData: () => getFeatureData<"overview">("/getOverviewData"),
  },
  items: {
    getData: () => getFeatureData<"items">("/getItemsData"),
  },
  armors: {
    getData: () => getFeatureData<"armors">("/getArmorsData"),
  },
  weapons: {
    getData: () => getFeatureData<"weapons">("/getWeaponsData"),
  },
  variables: {
    getData: () => getFeatureData<"variables">("/getVariablesData"),
  },
  switches: {
    getData: () => getFeatureData<"switches">("/getSwitchesData"),
  },
  actors: {
    getData: () => getFeatureData<"actors">("/getActorsData"),
  },
};

const shortcutActions = new Set<GameShortcutActionId>([
  "toggleThrough",
  "toggleEncounter",
  "toggleFormation",
  "toggleOneHitKill",
  "achieveVictory",
  "achieveDefeat",
]);

const shortcutPolicy: GameShortcutPolicy = {
  blockedKeysWithoutCtrlOrAlt: {
    F5: "MV/MZ 会把 F5 作为游戏重载键，可能导致游戏直接重新启动",
  },
};

/** MV/MZ 引擎通信、原始字段转换与能力声明。 */
export const mvmzAdapter: GameEngineAdapter = {
  features,
  shortcutActions,
  shortcutPolicy,

  async init(retries = 5, interval = 300, timeout = 500): Promise<boolean> {
    const ping = async (): Promise<boolean> => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(`${MVMZ_SERVICE_URL}/ping`, {
          signal: controller.signal,
        });
        return response.ok;
      } catch {
        return false;
      } finally {
        clearTimeout(id);
      }
    };

    for (let i = 0; i < retries; i++) {
      if (await ping()) return true;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    return false;
  },

  async setGameGold(amount: number): Promise<void> {
    await post("/setGold", { gold: amount });
  },

  async modifyVariables(id: number, value: string | number): Promise<void> {
    await post("/setVariables", { variablesId: id, value });
  },

  async modifySwitches(id: number, value: boolean): Promise<void> {
    await post("/setSwitches", { switchId: id, value });
  },

  async gainItems(id: number, count: number, gainType: string): Promise<void> {
    await post("/gainItem", { id, count, gainType });
  },

  async setInTeam(ids: Array<number>): Promise<void> {
    await post("/setActorInTeam", { ids });
  },

  async setActorData(actor: unknown): Promise<void> {
    await post("/setActorData", { actor });
  },

  async sendTranslationData(translated: unknown): Promise<void> {
    await post("/sendTranslationData", { translated });
  },

  async achieveVictory(): Promise<void> {
    await get("/performVictory", {});
  },

  async achieveDefeat(): Promise<void> {
    await get("/performDefeat", {});
  },

  async escapeBattle(): Promise<void> {
    await get("/performEscape", {});
  },

  async setSomeGameSettings(type: string, value: unknown): Promise<void> {
    await post("/setSomeGameSettings", { type, value });
  },
};

export default mvmzAdapter;
