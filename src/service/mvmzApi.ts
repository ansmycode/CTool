import { post, get } from "./request";

/**
 * 从指定的游戏中读取并返回当前的游戏状态数据。
 *
 * @returns {Object} 游戏数据对象
 * @returns {number} return.gold 玩家当前持有的金钱
 * @returns {boolean} return.isEncounterEnabled 是否允许遇敌（true 表示允许）
 * @returns {boolean} return.isFormationEnabled 是否允许更改队形（true 表示允许）
 * @returns {Array<Object>} return.allMembers 所有成员信息
 * @returns {Array<Object>} return.allArmors 游戏内所有防具数据
 * @returns {Array<Object>} return.allItem 游戏内所有物品数据
 * @returns {Array<Object>} return.allWeapons 游戏内所有武器数据
 * @returns {Array<Object>} return.variables 游戏内的变量数据（索引对应变量 ID）
 * @returns {Array<Object>} return.switches 游戏内的开关数据（索引对应开关 ID）
 * @returns {number} return.playerSpped 角色移动速度
 */
export const getMVMZGameData = async () => {
  return get("/getGameData", {});
};

//直接胜利
export const achieveVictory = async () => {
  return get("/performVictory", {});
};

//修改金钱
export async function setGold(amount: number) {
  return post("/setGold", {
    gold: amount,
  });
}

//修改物品
export async function callGainItem(
  id: number,
  count: number,
  gainType: string
) {
  return post("/gainItem", {
    id,
    count,
    gainType,
  });
}

//开关
export async function setSwitches(switchId: number, value: boolean) {
  return post("/setSwitches", {
    switchId,
    value,
  });
}

//变量
export async function setVariables(
  variablesId: number,
  value: string | number
) {
  return post("/setVariables", {
    variablesId,
    value,
  });
}

//变量
export async function setInTeam(ids: Array<number>) {
  return post("/setActorInTeam", {
    ids,
  });
}

//变量
export async function setActorData(actor: any) {
  return post("/setActorData", {
    actor,
  });
}

//加载翻译
export async function sendTranslationData(translated: any) {
  return post("/sendTranslationData", {
    translated,
  });
}

//修改一些游戏中的设置
export async function setSomeGameSettings(type: string, value: any) {
  return post("/setSomeGameSettings", {
    type,
    value,
  });
}
