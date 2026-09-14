import {discoverCollections} from "@/engine/wolf/databaseMapping.js";
import type {GameCollectionAccess,GameDatabaseAccess,DatabaseTable} from "@/game/database";

export function createWolfCollections(access:GameDatabaseAccess):GameCollectionAccess {
  let mappings:ReturnType<typeof discoverCollections>=[];
  async function catalog(kind:number){
    const tables:DatabaseTable[]=[];
    for(let start=0;start<4096;){
      const result=await access.read({operation:"catalog",kind,start,limit:8});
      if(result.status!=="available"||!("tables" in result))throw new Error("数据库尚未初始化，请进入地图后重试");
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
      return mappings.map(({key,label,total,inventoryStatus})=>({key,label,total,inventoryStatus}));
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
      const stock=mapping.inventoryCandidate;
      if(mapping.inventoryStatus==="basic-system-readonly"&&stock){
        // Initial metadata can be shorter than the runtime inventory after automatic expansion.
        const probe=await access.read({operation:"page",kind:1,table:stock.table,start:0,limit:1,fieldStart:stock.field,fieldLimit:1});
        const valid=(result:typeof probe)=>result.status==="available"&&"rows" in result&&result.name===stock.name&&result.fields[0]?.type==="number"&&result.fields[0]?.name===stock.fieldName;
        const runtimeTotal=valid(probe)&&"total" in probe?probe.total:undefined;
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
        return [{id:row.id,name,description:typeof description==="string"?description:"",owned:count,ownedReason:count!==undefined?undefined:unreadable.has(row.id)?"库存值不可读":ownedReason}];
      })};
    },
  };
}
