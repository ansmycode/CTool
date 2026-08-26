import { useMemo, useState } from "react";
import { getEngineAdapter } from "@/game/registry";
import { getShortcutActions } from "@/game/shortcutActions";
import type {
  EngineType,
  GameData,
  GameEngineAdapter,
  GameShortcutActionId,
} from "@/game/types";

export function useGameData(engineType: EngineType) {
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [isGameLinks, setIsGameLinks] = useState<boolean>(false);
  const adapter = useMemo(
    () => getEngineAdapter(engineType),
    [engineType],
  );

  const gameInit = async () => {
    const nextIsGameLinks = await adapter.init();
    setIsGameLinks(nextIsGameLinks);
    return nextIsGameLinks;
  };

  const getGameData = async () => {
    const data = await adapter.getData();
    setGameData(data);
  };

  const modify = async (
    action: (currentAdapter: GameEngineAdapter) => Promise<void> | undefined,
  ) => {
    await action(adapter);
    await getGameData();
  };

  const modifyGold = (amount: number) =>
    modify((currentAdapter) => currentAdapter.setGameGold(amount));

  const modifyVariable = (id: number, value: number | string) =>
    modify((currentAdapter) => currentAdapter.modifyVariables?.(id, value));

  const modifySwitch = (id: number, value: boolean) =>
    modify((currentAdapter) => currentAdapter.modifySwitches?.(id, value));

  const gainItem = (id: number, count: number, gainType: string) =>
    modify((currentAdapter) =>
      currentAdapter.gainItems?.(id, count, gainType),
    );

  const setInTeam = (ids: Array<number>) =>
    modify((currentAdapter) => currentAdapter.setInTeam?.(ids));

  const setActorData = (actor: any) =>
    modify((currentAdapter) => currentAdapter.setActorData?.(actor));

  const sendTranslationData = (translated: any) =>
    modify((currentAdapter) =>
      currentAdapter.sendTranslationData?.(translated),
    );

  const achieveVictory = () =>
    modify((currentAdapter) => currentAdapter.achieveVictory?.());

  const achieveDefeat = () =>
    modify((currentAdapter) => currentAdapter.achieveDefeat?.());

  const escapeBattle = () =>
    modify((currentAdapter) => currentAdapter.escapeBattle?.());

  const setSomeGameSettings = (type: string, value: any) =>
    modify((currentAdapter) =>
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

    const currentData = gameData ?? (await adapter.getData());
    const settingActions = {
      toggleThrough: ["through", !currentData.through],
      toggleEncounter: [
        "isEncounterEnabled",
        !currentData.isEncounterEnabled,
      ],
      toggleFormation: [
        "isFormationEnabled",
        !currentData.isFormationEnabled,
      ],
    } as const;
    const [setting, value] = settingActions[actionId];
    return setSomeGameSettings(setting, value);
  };

  return {
    gameData,
    isGameLinks,
    capabilities: adapter.capabilities,
    shortcutActions,
    getGameData,
    gameInit,
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
