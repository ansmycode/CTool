import { useMemo, useState } from "react";
import { getEngineAdapter } from "@/game/registry";
import type { EngineType, GameData, GameEngineAdapter } from "@/game/types";

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

  const setSomeGameSettings = (type: string, value: any) =>
    modify((currentAdapter) =>
      currentAdapter.setSomeGameSettings(type, value),
    );

  return {
    gameData,
    isGameLinks,
    capabilities: adapter.capabilities,
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
    setSomeGameSettings,
  };
}
