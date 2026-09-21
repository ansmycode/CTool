import type { GameEngineAdapter } from "@/game/types";
import {createWolfCollections} from "./wolfCollections";
import {withVariableNames} from "./wolfVariables";
import type {GameDatabaseAccess} from "@/game/database";
import { runtimeError } from "@/game/runtime";
import type { GameRuntimeAccess, WolfRuntimeRequest, WolfRuntimeResult, WolfRuntimeStatus, VariableCatalog, VariablePage } from "@/game/runtime";
// Only database access and bound gold writes; no fabricated MV/MZ overview fields.
const wolfAdapter: GameEngineAdapter = {
  features: {},
  shortcutActions: new Set(),
  shortcutPolicy: { blockedKeysWithoutCtrlOrAlt: {} },
  async init() { return false; },
};
export function createWolfAdapter(sessionId?:string):GameEngineAdapter {
  const request=async <T extends WolfRuntimeResult>(data:WolfRuntimeRequest):Promise<T>=>{
    if(!sessionId)throw new Error("游戏会话未就绪");
    const result=await window.electronAPI.wolfRuntime(sessionId,data);
    if(result.status==="unavailable")throw new Error(runtimeError(result.reason));
    return result as T; // Main-process protocol validates the reply against this operation.
  };
  const runtime:GameRuntimeAccess|undefined=sessionId?{
    status:()=>request<WolfRuntimeStatus>({operation:"runtime"}),
    groups:()=>request<VariableCatalog>({operation:"varcatalog"}),
    page:(group,start,limit)=>request<VariablePage>({operation:"varpage",group,start,limit}),
    setVariable:async(group,index,expected,value)=>{await request({operation:"varwrite",group,index,expected,value});},
    setSpeed:async value=>{await request({operation:"speed",value});},
    setNoclip:async value=>{await request({operation:"noclip",value});},
  }:undefined;
  const database:GameDatabaseAccess|undefined=sessionId?{
    read:request=>window.electronAPI.readGameDatabase(sessionId,request),
    selectGoldSource:target=>window.electronAPI.selectGameGoldSource(sessionId,target),
  }:undefined;
  return {...wolfAdapter,sessionId,runtime:runtime && database ? withVariableNames(runtime,database) : runtime,setGameGold:async(value,expectation)=>{
    if(!sessionId||!expectation)throw new Error("金币来源未就绪");
    await window.electronAPI.setGameGold(sessionId,value,expectation);
  },database,collections:database?createWolfCollections(database,(target,expected,value)=>window.electronAPI.setGameInventoryCount(sessionId!,target,expected,value)):undefined};
}
export default wolfAdapter;
