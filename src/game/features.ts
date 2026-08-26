export interface OverviewGameData {
  gold: number;
  isEncounterEnabled: boolean;
  isFormationEnabled: boolean;
  playerSpeed: number;
  gameSpeed: number;
  through: boolean;
  oneHitKillEnabled: boolean;
}

export interface InventoryGameData {
  id: number;
  name: string;
  playerHasCount: number;
}

export interface VariableGameData {
  id: number;
  variablesKey: string;
  variablesValue: string | number;
}

export interface SwitchGameData {
  id: number;
  switchesKey: string;
  switchesValue: boolean;
}

export interface ActorData {
  id: number;
  inTeam: boolean;
  name: string;
  level: number;
  classId: number;
  className: string;
  exp: number;
  mhp: number;
  mmp: number;
  tp: number;
  atk: number;
  def: number;
  mat: number;
  mdf: number;
  agi: number;
  luk: number;
}

export interface ClassData {
  id: number;
  name: string;
}

export interface ActorGameData {
  actors: ActorData[];
  classes: ClassData[];
}

export interface GameFeatureDataMap {
  overview: OverviewGameData;
  items: InventoryGameData[];
  armors: InventoryGameData[];
  weapons: InventoryGameData[];
  variables: VariableGameData[];
  switches: SwitchGameData[];
  actors: ActorGameData;
}

export type GameFeatureKey = keyof GameFeatureDataMap;

export type GameFeatureReaders = {
  [K in GameFeatureKey]?: {
    getData(): Promise<GameFeatureDataMap[K]>;
  };
};

export type GameFeatureState = {
  [K in GameFeatureKey]: GameFeatureDataMap[K] | null;
};

export function createEmptyGameFeatures(): GameFeatureState {
  return {
    overview: null,
    items: null,
    armors: null,
    weapons: null,
    variables: null,
    switches: null,
    actors: null,
  };
}
