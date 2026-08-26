import type {
  GameCapability,
  GameData,
  GameEngineAdapter,
  GameShortcutActionId,
} from "@/game/types";
import { get, MVMZ_SERVICE_URL, post } from "@/lib/http";

interface MVMZGameData {
  gold: number;
  allMembers: any[];
  allArmors: any[];
  allItem: any[];
  allWeapons: any[];
  isEncounterEnabled: boolean;
  isFormationEnabled: boolean;
  variables: any[];
  switches: any[];
  classList: any[];
  playerSpeed: number;
  gameSpeed: number;
  through: boolean;
  oneHitKillEnabled: boolean;
}

const capabilities = new Set<GameCapability>([
  "gold",
  "items",
  "armors",
  "weapons",
  "variables",
  "switches",
  "actors",
  "translation",
]);

const shortcutActions = new Set<GameShortcutActionId>([
  "toggleThrough",
  "toggleEncounter",
  "toggleFormation",
  "toggleOneHitKill",
  "achieveVictory",
  "achieveDefeat",
]);

/** MV/MZ 引擎通信、原始字段转换与能力声明。 */
export const mvmzAdapter: GameEngineAdapter = {
  capabilities,
  shortcutActions,

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

  async getData(): Promise<GameData> {
    const response = await get<MVMZGameData>("/getGameData", {});
    const raw = response.data as MVMZGameData;

    return {
      gold: raw.gold,
      actors: raw.allMembers,
      armors: raw.allArmors,
      items: raw.allItem,
      weapons: raw.allWeapons,
      isEncounterEnabled: raw.isEncounterEnabled,
      isFormationEnabled: raw.isFormationEnabled,
      variables: raw.variables,
      switches: raw.switches,
      classes: raw.classList,
      playerSpeed: raw.playerSpeed,
      gameSpeed: raw.gameSpeed,
      through: raw.through,
      oneHitKillEnabled: raw.oneHitKillEnabled,
    };
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

  async setActorData(actor: any): Promise<void> {
    await post("/setActorData", { actor });
  },

  async sendTranslationData(translated: any): Promise<void> {
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

  async setSomeGameSettings(type: string, value: any): Promise<void> {
    await post("/setSomeGameSettings", { type, value });
  },
};

export default mvmzAdapter;
