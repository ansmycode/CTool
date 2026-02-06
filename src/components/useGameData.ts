import { useState, useMemo } from "react";
import type { EngineType, GameData, GameEngineAdapter } from "@/types/Game";
import MVAdapter from "@/components/adapters/MVAdapter";
// import { WolfAdapter } from "../adapters/WolfAdapter"; // 可扩展

export function useGameData(engineType: EngineType) {
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [isGameLinks, setIsGameLinks] = useState<boolean>(false);

  // 根据 engineType 选择 Adapter
  const adapter: GameEngineAdapter = useMemo(() => {
    switch (engineType) {
      case "MV":
      case "MZ":
        return new MVAdapter();
      // case "wolf":
      //   return new WolfAdapter();
      //   break;
      default:
        throw new Error(`未支持的引擎类型: ${engineType}`);
    }
  }, [engineType]);

  //游戏初始化
  const gameInit = async () => {
    const _isGameLinks = await adapter.init();
    setIsGameLinks(_isGameLinks);
    return _isGameLinks;
  };

  /**获取游戏数据 */
  const getGameData = async () => {
    const data = await adapter.getData();
    setGameData(data);
  };

  // 核心统一修改函数，自动刷新数据
  const modify = async (
    action: (adapter: GameEngineAdapter) => Promise<void> | undefined
  ) => {
    await action(adapter);
    await getGameData();
  };

  /**修改金币 */
  const modifyGold = (amount: number) => modify((a) => a.setGameGold(amount));

  /**修改变量 */
  const modifyVariable = (id: number, value: number | string) =>
    modify((a) => a.modifyVariables?.(id, value));

  /**修改开关 */
  const modifySwitch = (id: number, value: boolean) =>
    modify((a) => a.modifySwitches?.(id, value));

  /**添加物品 */
  const gainItem = (id: number, count: number, gainType: string) =>
    modify((a) => a.gainItems?.(id, count, gainType));

  /**角色入队 */
  const setInTeam = (ids: Array<number>) => modify((a) => a.setInTeam?.(ids));

  /**修改角色属性 */
  const setActorData = (actor: any) => modify((a) => a.setActorData?.(actor));

  /**加载翻译 */
  const sendTranslationData = (translated: any) =>
    modify((a) => a.sendTranslationData?.(translated));

  /**直接取得胜利 */
  const achieveVictory = () => modify((a) => a.achieveVictory?.());

  /**设置角色移动速度 */
  const setSomeGameSettings = (type: string, value: any) =>
    modify((a) => a.setSomeGameSettings?.(type, value));

  return {
    gameData,
    isGameLinks,
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
