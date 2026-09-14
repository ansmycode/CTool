import { identifyGold } from "./databaseSemantics.js";
export function createGoldMonitor(request,emit) {
  let stopped=false,timer,selected,candidates=[],source="auto",generation=0,writing=false;
  const unavailable=reason=>emit({status:"unavailable",reason,candidates});
  async function cycle() {
    const token=generation;
    try {
      if(!selected){
        const tables=[];
        for(let start=0;start<4096;){
          const page=await request({operation:"catalog",kind:1,start,limit:8});
          if(stopped||token!==generation)return;
          if(page.status!=="available"){unavailable(page.reason);return;}
          tables.push(...page.tables);start+=page.tables.length;
          if(start>=page.total)break;
          if(!page.tables.length)throw new Error("incomplete_catalog");
        }
        const result=identifyGold(tables);candidates=result.candidates;
        if(tables.some(t=>t.reason)){unavailable("incomplete_catalog");return;}
        selected=result.selected;
        if(!selected){unavailable(result.reason);return;}
      }
      const page=await request({operation:"page",kind:selected.kind,table:selected.table,start:selected.row,limit:1,fieldStart:selected.field,fieldLimit:1});
      if(stopped||token!==generation)return;
      const value=page.status==="available"?page.rows[0]?.values[0]:null;
      if(source==="auto"&&page.status==="available"&&(page.name!==selected.tableName||page.fields[0]?.name!==selected.fieldName)){
        selected=undefined;unavailable("gold_schema_changed");return;
      }
      if(typeof value!=="number"){unavailable(page.reason||"gold_cell_unavailable");if(source==="auto")selected=undefined;return;}
      // Keep current schema labels visible; do not persist addresses or assume an EXE-specific slot.
      emit({status:"available",value,observedAt:Date.now(),source:{...selected,mode:source},candidates});
    }catch(e){if(!stopped&&token===generation)unavailable(e.message);}
    finally{if(!stopped&&token===generation)timer=setTimeout(cycle,selected?1000:5000);timer?.unref?.();}
  }
  return {
    start(){stopped=false;void cycle();},
    select(target){
      if(writing)throw new Error("正在修改金币，请稍后切换来源");
      if(target!==null&&(!target||!Number.isInteger(target.kind)||target.kind<0||target.kind>2||
        !Number.isInteger(target.table)||target.table<0||target.table>4095||!Number.isInteger(target.row)||target.row<0||target.row>99999||
        !Number.isInteger(target.field)||target.field<0||target.field>4095))throw new Error("无效金币映射");
      generation++;selected=target?{kind:target.kind,table:target.table,row:target.row,field:target.field,label:"手动选择的数据库字段",evidence:"manual"}:undefined;
      source=target?"manual":"auto";
      // In-flight cycle will finish without publishing; schedule only one replacement.
      clearTimeout(timer);timer=setTimeout(cycle,250);timer.unref?.();
    },
    async write(value,expectation){
      if(stopped||writing||!selected||selected.kind!==1)throw new Error("金币来源未就绪或正在修改");
      if(!Number.isInteger(value)||value<0||value>2147483647||!expectation||!Number.isInteger(expectation.value)||
        expectation.value< -2147483648||expectation.value>2147483647||
        !["kind","table","row","field"].every(key=>selected[key]===expectation.source?.[key]))throw new Error("金额无效或金币来源已变化，请刷新后重试");
      writing=true;generation++;const token=generation;clearTimeout(timer);let submitted=false;
      try{
        const page=await request({operation:"page",kind:1,table:selected.table,start:selected.row,limit:1,fieldStart:selected.field,fieldLimit:1});
        if(stopped||token!==generation)throw new Error("游戏会话已变化");
        if(page.status!=="available"||page.rows[0]?.values[0]!==expectation.value||page.fields[0]?.type!=="number")throw new Error("金币已变化或不可读，请刷新后重试");
        if(source==="auto"&&(page.name!==selected.tableName||page.fields[0]?.name!==selected.fieldName))throw new Error("金币结构已变化，请重新识别");
        submitted=true;
        const result=await request({operation:"goldwrite",...selected,expected:expectation.value,value});
        if(stopped||token!==generation)throw new Error("会话已变化，写入结果未确认");
        if(result.status!=="written")throw new Error(`${result.reason}；请核对游戏金额后再操作，勿自动重试`);
        emit({status:"available",value:result.value,observedAt:Date.now(),source:{...selected,mode:source},candidates});
      }catch(error){
        if(submitted)throw new Error(`${error.message}；请求已发出，请先核对游戏金额，未确认前不要重复提交`);
        throw error;
      }finally{writing=false;if(!stopped&&token===generation){timer=setTimeout(cycle,0);timer.unref?.();}}
    },
    stop(){stopped=true;generation++;clearTimeout(timer);},
  };
}
