export type GameCapability =
  | "gold"
  | "items"
  | "armors"
  | "weapons"
  | "variables"
  | "switches"
  | "actors"
  | "translation";

export interface GameData {
  gold: number;
  actors: any[];
  armors: any[];
  items: any[];
  weapons: any[];
  isEncounterEnabled: boolean;
  isFormationEnabled: boolean;
  variables: any[];
  switches: any[];
  classes: any[];
  playerSpeed: number;
  gameSpeed: number;
  through: boolean;
}

export interface GameEngineAdapter {
  readonly capabilities: ReadonlySet<GameCapability>;
  init(): Promise<boolean>;
  getData(): Promise<GameData>;
  setGameGold(amount: number): Promise<void>;
  modifyVariables?(id: number, value: number | string): Promise<void>;
  modifySwitches?(id: number, value: boolean): Promise<void>;
  gainItems?(id: number, count: number, gainType: string): Promise<void>;
  setInTeam?(ids: Array<number>): Promise<void>;
  setActorData?(actor: any): Promise<void>;
  sendTranslationData?(translated: any): Promise<void>;
  achieveVictory?(): Promise<void>;
  achieveDefeat?(): Promise<void>;
  escapeBattle?(): Promise<void>;
  setSomeGameSettings(type: string, value: any): Promise<void>;
}

export type EngineType = "MV" | "MZ" | "wolf" | null;

// export type FilterRules = {
//   invalid: boolean;
//   command: boolean;
//   merge: boolean;
//   regexList: string[];
// };
