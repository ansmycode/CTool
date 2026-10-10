import {discoverCollections} from "@/engine/wolf/databaseMapping.js";
import type {GameCollectionAccess,GameDatabaseAccess,DatabaseTable,InventoryRecordRef} from "@/game/database";

export function createWolfCollections(access:GameDatabaseAccess,writeCount?:(target:InventoryRecordRef,expected:number,value:number)=>Promise<void>):GameCollectionAccess {
  let mappings:ReturnType<typeof discoverCollections>=[];
  type Page = Awaited<ReturnType<GameCollectionAccess['page']>>;
  const cache = new Map<string, Page>();
  const generations = new Map<string, number>();
  let sequence = 0;
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
    cached: key => {
      const saved = cache.get(key);
      return saved ? { total: saved.total, rows: saved.rows.map(row => ({ ...row,
        owned: undefined, ownedReason: '正在刷新数量', writable: false, inventoryTarget: undefined })) } : undefined;
    },
    async load(key, options = {}) {
      const generation = ++sequence;
      generations.set(key, generation);
      try {
      const check = () => {
        options.signal?.throwIfAborted();
        if (generations.get(key) !== generation) throw new Error('读取已被新的刷新替代');
      };
      if (options.full) {
        cache.delete(key);
        const user = await catalog(0), variable = await catalog(1);
        check(); mappings = discoverCollections(user, variable);
      }
      const mapping = mappings.find(item => item.key === key);
      if (!mapping) throw new Error('资料映射已变化，请重新连接游戏');
      const d = mapping.definition;
      const fieldStart = Math.min(d.nameField, d.descriptionField ?? d.nameField);
      const fieldLimit = Math.max(d.nameField, d.descriptionField ?? d.nameField) - fieldStart + 1;
      const combined = fieldLimit <= 16;
      const read = async (start: number, limit: number, field: number, count: number) => {
        check();
        const result = await access.read({ operation: 'page', kind: 0, table: d.table, start, limit, fieldStart: field, fieldLimit: count });
        check();
        if (result.status !== 'available' || !('rows' in result) || result.name !== d.name ||
          result.rows.length !== Math.min(limit, result.total - start) ||
          result.rows.some((row, i) => row.id !== start + i)) throw new Error('资料结构已变化或不可读，请完整刷新');
        for (const [id, name] of [[d.nameField, d.nameFieldName], [d.descriptionField, d.descriptionFieldName]] as const) {
          if (id === undefined || id < field || id >= field + count) continue;
          const actual = result.fields.find(item => item.id === id);
          if (actual?.type !== 'string' || actual.name !== name) throw new Error('资料字段已变化，请完整刷新');
        }
        return result;
      };
      let saved = cache.get(key);
      // Check the live definition header even when its text is cached.
      const probe = await read(0, 1, combined ? fieldStart : d.nameField, combined ? fieldLimit : 1);
      if (saved && probe.total !== saved.total) { cache.delete(key); saved = undefined; }
      if (!saved) {
        const rows: Page['rows'] = [];
        const total = probe.total;
        for (let start = 0; start < total; start += 10) {
          const names = await read(start, 10, combined ? fieldStart : d.nameField, combined ? fieldLimit : 1);
          const descriptions = !combined && d.descriptionField !== undefined ? await read(start, 10, d.descriptionField, 1) : names;
          if (names.total !== total || descriptions.total !== total) throw new Error('数据库正在变化，请完整刷新');
          for (let i = 0; i < names.rows.length; i++) {
            const name = names.rows[i].values[names.fields.findIndex(field => field.id === d.nameField)];
            const description = d.descriptionField === undefined ? '' : descriptions.rows[i].values[descriptions.fields.findIndex(field => field.id === d.descriptionField)];
            if (typeof name !== 'string' || !name.trim() || /^[-─━\s]+$/.test(name)) continue;
            rows.push({ id: names.rows[i].id, name, description: typeof description === 'string' ? description : '' });
          }
          options.onProgress?.(Math.min(start + 10, total), total);
        }
        check();
        saved = { total, rows }; cache.set(key, saved);
      }
      const stock = mapping.quantityBinding;
      const owned = new Map<number, number | null>();
      let runtimeTotal: number | undefined;
      let reason = '库存映射尚未确认';
      const begin = options.start === undefined ? 0 : Math.floor(options.start / 100) * 100;
      const end = options.start === undefined ? saved.total : Math.min(saved.total, begin + 100);
      if (mapping.inventoryStatus === 'basic-system' && stock) {
        const valid = (result: Awaited<ReturnType<GameDatabaseAccess['read']>>) => result.status === 'available' && 'rows' in result &&
          result.name === stock.tableName && result.fields[0]?.id === stock.field &&
          result.fields[0]?.name === stock.fieldName && result.fields[0]?.type === 'number';
        const header = await access.read({ operation: 'numberpage', kind: stock.kind, table: stock.table, start: 0, limit: 1, fieldStart: stock.field });
        check(); reason = '库存读取失败或结构已变化';
        if (valid(header) && header.status === 'available' && 'rows' in header) {
          runtimeTotal = header.total;
          for (let start = begin; start < Math.min(end, runtimeTotal); start += 100) {
            const limit = Math.min(100, end - start);
            const result = await access.read({ operation: 'numberpage', kind: stock.kind, table: stock.table, start, limit, fieldStart: stock.field });
            check();
            if (!valid(result) || result.status !== 'available' || !('rows' in result) || result.total !== runtimeTotal ||
              result.rows.length !== Math.min(limit, runtimeTotal - start) || result.rows.some((row, i) => row.id !== start + i)) {
              runtimeTotal = undefined; owned.clear(); break;
            }
            for (const row of result.rows) {
              const value = row.values[0];
              owned.set(row.id, typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null);
            }
          }
        }
      }
      check();
      const result: Page = { total: saved.total, rows: saved.rows.map(row => {
        if (row.id < begin || row.id >= end) return row;
        const value = owned.get(row.id);
        const count = runtimeTotal === undefined || value === null ? undefined : value ?? (row.id >= runtimeTotal ? 0 : undefined);
        const writable = !!(mapping.writable && stock && count !== undefined && runtimeTotal !== undefined && row.id < runtimeTotal);
        return { ...row, owned: count, ownedReason: count !== undefined ? undefined : value === null ? '库存值不可读' : reason,
          writable, inventoryTarget: writable ? { collectionKey: key, itemId: row.id } : undefined };
      }) };
      cache.set(key, result);
      return result;
      } catch (error) {
        if (generations.get(key) === generation && !options.signal?.aborted) cache.delete(key);
        throw error;
      }
    },
    async list(){
      cache.clear(); generations.clear();
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
      const stock=mapping.quantityBinding;
      if(mapping.inventoryStatus==="basic-system"&&stock){
        // Re-check the live count table before every category read. A save load
        // can replace it, and its initial directory row count may be stale.
        const probe=await access.read({operation:"page",kind:stock.kind,table:stock.table,start:0,limit:1,fieldStart:stock.field,fieldLimit:1});
        const valid=(result:typeof probe)=>result.status==="available"&&"rows" in result&&result.name===stock.tableName&&result.fields[0]?.type==="number"&&result.fields[0]?.name===stock.fieldName;
        runtimeTotal=valid(probe)&&"total" in probe?probe.total:undefined;
        ownedReason="库存读取失败或结构已变化";
        inventoryRead=runtimeTotal!==undefined&&start>=runtimeTotal;
        const result=runtimeTotal!==undefined&&start<runtimeTotal?await access.read({operation:"page",kind:stock.kind,table:stock.table,start,limit:10,fieldStart:stock.field,fieldLimit:1}):undefined;
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
          // A displayed zero without a runtime record is intentionally
          // read-only: the native writer requires an existing numeric record.
          writable:canWrite,
          inventoryTarget: canWrite
            ? {collectionKey:mapping.key,itemId:row.id} : undefined}];
      })};
    },
    async setCount(target,expected,value){
      if(!Number.isInteger(expected)||expected<0||!Number.isInteger(value)||value<0||value>2147483647)throw new Error("数量必须是非负整数");
      if(!writeCount)throw new Error("背包数量修改未就绪");
      await writeCount(target,expected,value);
    },
  };
}
