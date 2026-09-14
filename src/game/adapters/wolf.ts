import type { GameEngineAdapter } from "@/game/types";
import {createWolfCollections} from "./wolfCollections";
import type {GameDatabaseAccess} from "@/game/database";
// Only database access and bound gold writes; no fabricated MV/MZ overview fields.
const wolfAdapter: GameEngineAdapter = {
  features: {},
  shortcutActions: new Set(),
  shortcutPolicy: { blockedKeysWithoutCtrlOrAlt: {} },
  async init() { return false; },
};
export function createWolfAdapter(sessionId?:string):GameEngineAdapter {
  const database:GameDatabaseAccess|undefined=sessionId?{
    read:request=>window.electronAPI.readGameDatabase(sessionId,request),
    selectGoldSource:target=>window.electronAPI.selectGameGoldSource(sessionId,target),
  }:undefined;
  return {...wolfAdapter,sessionId,setGameGold:async(value,expectation)=>{
    if(!sessionId||!expectation)throw new Error("金币来源未就绪");
    await window.electronAPI.setGameGold(sessionId,value,expectation);
  },database,collections:database?createWolfCollections(database):undefined};
}
export default wolfAdapter;
