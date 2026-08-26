import { useCallback, useMemo, useState } from "react";
import { createEmptyGameFeatures } from "@/game/features";
import { getEngineAdapter } from "@/game/registry";
import { getShortcutActions } from "@/game/shortcutActions";
import type {
  GameFeatureDataMap,
  GameFeatureKey,
} from "@/game/features";
import type {
  EngineType,
  GameCapability,
  GameEngineAdapter,
  GameShortcutActionId,
} from "@/game/types";

export function useGameFeatures(engineType: EngineType) {
  const [features, setFeatures] = useState(createEmptyGameFeatures);
  const adapter = useMemo(
    () => getEngineAdapter(engineType),
    [engineType],
  );
  const capabilities = useMemo(
    () =>
      new Set<GameCapability>([
        ...(Object.keys(adapter.features) as GameFeatureKey[]),
        ...(adapter.sendTranslationData ? (["translation"] as const) : []),
      ]),
    [adapter],
  );

  const refreshFeature = useCallback(
    async <K extends GameFeatureKey>(
      key: K,
    ): Promise<GameFeatureDataMap[K]> => {
      const reader = adapter.features[key];
      if (!reader) {
        throw new Error(`当前游戏引擎不支持 ${key} 数据`);
      }

      const data = await reader.getData();
      setFeatures((current) => ({ ...current, [key]: data }));
      return data;
    },
    [adapter],
  );

  const modify = async (
    feature: GameFeatureKey,
    action: (currentAdapter: GameEngineAdapter) => Promise<void> | undefined,
  ) => {
    await action(adapter);
    await refreshFeature(feature);
  };

  const modifyGold = (amount: number) =>
    modify("overview", (currentAdapter) =>
      currentAdapter.setGameGold(amount),
    );

  const modifyVariable = (id: number, value: number | string) =>
    modify("variables", (currentAdapter) =>
      currentAdapter.modifyVariables?.(id, value),
    );

  const modifySwitch = (id: number, value: boolean) =>
    modify("switches", (currentAdapter) =>
      currentAdapter.modifySwitches?.(id, value),
    );

  const gainItem = (id: number, count: number, gainType: string) => {
    const feature =
      gainType === "armor"
        ? "armors"
        : gainType === "weapon"
          ? "weapons"
          : "items";
    return modify(feature, (currentAdapter) =>
      currentAdapter.gainItems?.(id, count, gainType),
    );
  };

  const setInTeam = (ids: Array<number>) =>
    modify("actors", (currentAdapter) => currentAdapter.setInTeam?.(ids));

  const setActorData = (actor: unknown) =>
    modify("actors", (currentAdapter) =>
      currentAdapter.setActorData?.(actor),
    );

  const sendTranslationData = async (translated: unknown) => {
    await adapter.sendTranslationData?.(translated);
  };

  const achieveVictory = async () => {
    await adapter.achieveVictory?.();
  };

  const achieveDefeat = async () => {
    await adapter.achieveDefeat?.();
  };

  const escapeBattle = async () => {
    await adapter.escapeBattle?.();
  };

  const setSomeGameSettings = (type: string, value: unknown) =>
    modify("overview", (currentAdapter) =>
      currentAdapter.setSomeGameSettings(type, value),
    );

  const shortcutActions = useMemo(
    () => getShortcutActions(adapter.shortcutActions),
    [adapter],
  );

  const executeShortcutAction = async (actionId: GameShortcutActionId) => {
    if (!adapter.shortcutActions.has(actionId)) {
      throw new Error("当前游戏引擎不支持此快捷功能");
    }

    if (actionId === "achieveVictory") {
      return achieveVictory();
    }
    if (actionId === "achieveDefeat") {
      return achieveDefeat();
    }

    const overview =
      features.overview ?? (await refreshFeature("overview"));
    const settingActions = {
      toggleThrough: ["through", !overview.through],
      toggleEncounter: [
        "isEncounterEnabled",
        !overview.isEncounterEnabled,
      ],
      toggleFormation: [
        "isFormationEnabled",
        !overview.isFormationEnabled,
      ],
      toggleOneHitKill: [
        "oneHitKillEnabled",
        !overview.oneHitKillEnabled,
      ],
    } as const;
    const [setting, value] = settingActions[actionId];
    return setSomeGameSettings(setting, value);
  };

  return {
    features,
    capabilities,
    shortcutActions,
    shortcutPolicy: adapter.shortcutPolicy,
    refreshFeature,
    modifyGold,
    modifyVariable,
    modifySwitch,
    gainItem,
    setInTeam,
    setActorData,
    sendTranslationData,
    achieveVictory,
    achieveDefeat,
    escapeBattle,
    setSomeGameSettings,
    executeShortcutAction,
  };
}
