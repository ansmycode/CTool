import {discoverCollections} from "@/engine/wolf/databaseMapping.js";
import type {GameCollectionAccess,GameDatabaseAccess,DatabaseTable,DatabaseCellRef} from "@/game/database";

export function createWolfCollections(access:GameDatabaseAccess,writeCount?:(target:DatabaseCellRef,expected:number,value:number)=>Promise<void>):GameCollectionAccess {
  let mappings:ReturnType<typeof discoverCollections>=[];
  async function catalog(kind:number){
    const tables:DatabaseTable[]=[];
    for(let start=0;start<4096;){
      const result=await access.read({operation:"catalog",kind,start,limit:8});
      if(result.status!=="available"){
        if(result.reason==="database_not_ready")throw new Error("数据库尚未初始化，请进入地图后重试");
        throw new Error(`数据库目录不可读：${result.reason}`);
      }
      if(!("tables" in result))throw new Error("数据库目录响应无效");
      tables.push(...result.tables);start+=result.tables.length;
      if(start>=result.total)return tables;
      if(!result.tables.length)throw new Error("数据库目录不完整");
    }
    throw new Error("数据库目录超出范围");
  }
  return {
    async list(){
      mappings=[];
      const user=await catalog(0),variable=await catalog(1);
      mappings=discoverCollections(user,variable);
      return mappings.map(({key,label,total,inventoryStatus,writable})=>({key,label,total,inventoryStatus,writable}));
    },
    async page(key,start){
      const mapping=mappings.find(m=>m.key===key);
      if(!mapping)throw new Error("资料映射已变化，请刷新列表");
      const d=mapping.definition;
      const read=async(field:number)=>{
        const result=await access.read({operation:"page",kind:0,table:d.table,start,limit:10,fieldStart:field,fieldLimit:1});
        if(result.status!=="available"||!("rows" in result)||result.name!==d.name||result.fields[0]?.type!=="string"||result.fields[0]?.name!==(field===d.nameField?d.nameFieldName:d.descriptionFieldName))throw new Error("资料结构已变化或不可读，请刷新列表");
        return result;
      };
      const names=await read(d.nameField);
      const descriptions=d.descriptionField===undefined?undefined:await read(d.descriptionField);
      const owned=new Map<number,number>();
      const unreadable=new Set<number>();
      let ownedReason="库存映射尚未确认";
      let inventoryRead=false;
      let runtimeTotal:number|undefined;
      const stock=mapping.inventoryCandidate;
      if(mapping.inventoryStatus==="basic-system-readonly"&&stock){
        // Initial metadata can be shorter than the runtime inventory after automatic expansion.
        const probe=await access.read({operation:"page",kind:1,table:stock.table,start:0,limit:1,fieldStart:stock.field,fieldLimit:1});
        const valid=(result:typeof probe)=>result.status==="available"&&"rows" in result&&result.name===stock.name&&result.fields[0]?.type==="number"&&result.fields[0]?.name===stock.fieldName;
        runtimeTotal=valid(probe)&&"total" in probe?probe.total:undefined;
        ownedReason="库存读取失败或结构已变化";
        inventoryRead=runtimeTotal!==undefined&&start>=runtimeTotal;
        const result=runtimeTotal!==undefined&&start<runtimeTotal?await access.read({operation:"page",kind:1,table:stock.table,start,limit:10,fieldStart:stock.field,fieldLimit:1}):undefined;
        if(result&&valid(result)&&result.status==="available"&&"rows" in result&&result.total===runtimeTotal&&
          result.rows.length===Math.min(10,result.total-start)&&result.rows.every((row,i)=>row.id===start+i)){
          inventoryRead=true;
          for(const row of result.rows){const v=row.values[0];if(typeof v==="number"&&Number.isInteger(v)&&v>=0)owned.set(row.id,v);else unreadable.add(row.id);}
        }
        else if(result)ownedReason="库存读取失败或结构已变化";
      }
      if(descriptions&&descriptions.total!==names.total)throw new Error("数据库正在变化，请重试");
      return {total:names.total,rows:names.rows.flatMap((row,i)=>{
        const name=row.values[0];const description=descriptions?.rows[i]?.values[0];
        // Keep actual record ids; filtering empty/separator entries must never renumber them.
        if(typeof name!=="string"||!name.trim()||/^[-─━\s]+$/.test(name))return [];
        const count=owned.get(row.id)??(inventoryRead&&!unreadable.has(row.id)?0:undefined);
        const canWrite=!!(mapping.writable&&stock&&inventoryRead&&runtimeTotal!==undefined&&row.id<runtimeTotal&&!unreadable.has(row.id));
        return [{id:row.id,name,description:typeof description==="string"?description:"",owned:count,ownedReason:count!==undefined?undefined:unreadable.has(row.id)?"库存值不可读":ownedReason,
          // A displayed zero beyond runtimeTotal is intentionally read-only: it
          // has no backing numeric slot yet.
          writable:canWrite,
          inventoryTarget: canWrite
            ? {kind:1,table:stock.table,row:row.id,field:stock.field} : undefined}];
      })};
    },
    async setCount(target,expected,value){
      if(!Number.isInteger(expected)||expected<0||!Number.isInteger(value)||value<0||value>2147483647)throw new Error("数量必须是非负整数");
      if(!writeCount)throw new Error("背包数量修改未就绪");
      await writeCount(target,expected,value);
    },
  };
}
