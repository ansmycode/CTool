export interface GameData {
  gold: number; // 金钱
  allMembers: any[]; // 队伍成员数组
  allArmors: any[]; // 防具数组
  allItem: any[]; // 物品数组
  allWeapons: any[]; // 武器数组
  isEncounterEnabled: boolean; // 是否允许遇敌
  isFormationEnabled: boolean; // 是否允许更改队形
  variables: any[]; // 变量数组
  switches: any[]; // 开关数组
  classList: any[]; //职业数组
  playerSpeed: number; //移动速度
  through: boolean; //是否可穿墙
}

export interface GameEngineAdapter {
  /** 初始化，连接游戏数据 */
  init(): Promise<boolean>;

  /** 获取当前游戏数据 */
  getData(): Promise<GameData>;

  /** 修改金币 */
  setGameGold(amount: number): Promise<void>;

  /** 修改变量 */
  modifyVariables?(id: number, value: number | string): Promise<void>;

  /** 修改开关 */
  modifySwitches?(id: number, value: boolean): Promise<void>;

  /** 添加物品 */
  gainItems?(id: number, count: number, gainType: string): Promise<void>;

  /** 添加物品 */
  gainItems?(id: number, count: number, gainType: string): Promise<void>;

  /** 设置角色入队 */
  setInTeam?(ids: Array<number>): Promise<void>;

  /** 更改角色数据 */
  setActorData?(actor: any): Promise<void>;

  /** 加载翻译 */
  sendTranslationData?(translated: any): Promise<void>;

  /** 直接取得胜利 */
  achieveVictory?(): Promise<void>;

  /** 修改一些游戏设置 */
  setSomeGameSettings(type: string, value: any): Promise<void>;
}

export type EngineType = "MV" | "MZ" | "wolf" | null;

export type FilterRules = {
  invalid: boolean; // 无效文本过滤
  command: boolean; // 指令文本过滤
  merge: boolean; // 整句拼接
  regexList: string[]; // 自定义正则
};
