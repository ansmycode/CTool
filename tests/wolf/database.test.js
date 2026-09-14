import test from "node:test";
import assert from "node:assert/strict";
import {identifyGold,tableCategory} from "../../src/electron/wolf/databaseSemantics.js";
import {createDatabaseRpc,validateDatabaseRequest,validateDatabaseReply} from "../../src/electron/wolf/databaseProtocol.js";
import {createGoldMonitor} from "../../src/electron/wolf/goldMonitor.js";
const table=(id=6,name="パーティー情報")=>({id,name,rowCount:1,fieldCount:7,fields:[{id:0,name:"所持金",type:"number"},...Array.from({length:6},(_,i)=>({id:i+1,name:`メンバー${i+1}`,type:"number"}))]});
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test("gold write protocol bounds and acknowledgement",()=>{
  const request={operation:"goldwrite",kind:1,table:6,row:0,field:0,expected:9500,value:10000};
  assert.deepEqual(validateDatabaseRequest(request),[1,6,0,0,9500,10000]);
  for(const patch of [{kind:0},{kind:2},{value:-1},{value:2147483648},{expected:NaN},{row:-1},{field:4096}])assert.throws(()=>validateDatabaseRequest({...request,...patch}));
  assert.equal(validateDatabaseReply({status:"written",value:10000},request).value,10000);
  assert.throws(()=>validateDatabaseReply({status:"written",value:1},request));
});

test("gold write checks selected source, old value, busy state and emits verified value",async()=>{
  let amount=9500;const operations=[],observations=[];
  const monitor=createGoldMonitor(async request=>{
    operations.push(request.operation);
    if(request.operation==="catalog")return {status:"available",total:1,tables:[table(0)]};
    if(request.operation==="page")return {status:"available",name:"パーティー情報",fields:[table().fields[0]],rows:[{values:[amount]}]};
    amount=request.value;return {status:"written",value:amount};
  },v=>observations.push(v));
  monitor.start();await tick();
  const expectation={value:9500,source:{kind:1,table:0,row:0,field:0}};
  await assert.rejects(monitor.write(10000,{...expectation,source:{...expectation.source,table:5}}),/来源已变化/);
  await assert.rejects(monitor.write(10000,{...expectation,value:5000}),/金币已变化/);
  const pending=monitor.write(10000,expectation);
  assert.throws(()=>monitor.select(null),/正在修改/);
  await assert.rejects(monitor.write(20000,expectation),/正在修改/);
  await pending;monitor.stop();
  assert.equal(amount,10000);assert.equal(observations.at(-1).value,10000);
  assert.equal(operations.filter(x=>x==="goldwrite").length,1);
  await assert.rejects(monitor.write(30000,expectation),/未就绪/);
});

test("disconnect during gold preflight sends no write",async()=>{
  let release;let block=false;let writes=0;
  const monitor=createGoldMonitor(async request=>{
    if(request.operation==="catalog")return {status:"available",total:1,tables:[table(0)]};
    if(request.operation==="goldwrite"){writes++;return {status:"written",value:1};}
    if(block)return new Promise(resolve=>{release=resolve;});
    return {status:"available",name:"パーティー情報",fields:[table().fields[0]],rows:[{values:[9500]}]};
  },()=>{});
  monitor.start();await tick();block=true;
  const pending=monitor.write(1,{value:9500,source:{kind:1,table:0,row:0,field:0}});
  monitor.stop();release({status:"unavailable"});await assert.rejects(pending,/会话已变化/);assert.equal(writes,0);
});
test("basic system semantics are independent of table index and support translated labels",()=>{
  assert.equal(identifyGold([table(3)]).selected.table,3);
  assert.equal(identifyGold([table(42)]).selected.table,42);
  const translated=table(9,"Party Info");translated.fields=translated.fields.map((f,i)=>({...f,name:i?`Member ${i}`:"Gold"}));
  assert.equal(identifyGold([translated]).selected.table,9);
  const custom=table(77,"自定义钱包");
  assert.equal(identifyGold([custom]).selected,undefined);
  assert.equal(identifyGold([custom]).candidates.length,1);
});
test("save/carryover data are excluded, duplicate strong candidates never auto-select",()=>{
  assert.equal(identifyGold([table(6),table(95,"【RPG】パーティー情報"),table(62,"セーブ情報")]).selected.table,6);
  assert.equal(identifyGold([table(3),table(6)]).selected,undefined);
  assert.equal(identifyGold([table(62,"セーブ情報")]).candidates.length,0);
  const unknown=table();unknown.fields=[];assert.equal(identifyGold([unknown]).selected,undefined);
  assert.equal(tableCategory({name:"アイテム"},0),"道具定义候选");
  assert.equal(tableCategory({name:"武器"},1),"武器数据候选");
});
test("database request limits and strict page shape validation",()=>{
  const request={operation:"page",kind:1,table:6,start:0,limit:1,fieldStart:0,fieldLimit:1};
  assert.deepEqual(validateDatabaseRequest(request),[1,6,0,1,0,1]);
  for(const patch of [{kind:99},{start:-1},{limit:100},{fieldLimit:100},{table:"6"},{operation:"write"}])assert.throws(()=>validateDatabaseRequest({...request,...patch}));
  const reply={status:"available",kind:1,table:6,name:"Party",total:1,fieldCount:7,fields:[{id:0,name:"Gold",type:"number"}],rows:[{id:0,name:"Main",values:[9500]}]};
  assert.equal(validateDatabaseReply(reply,request),reply);
  assert.throws(()=>validateDatabaseReply({...reply,kind:0},request));
  assert.throws(()=>validateDatabaseReply({...reply,rows:[{id:0,name:"Main",values:["9500"]}]},request));
  assert.throws(()=>validateDatabaseReply({...reply,rows:[{id:0,name:"Main",values:[2147483648]}]},request));
  assert.equal(validateDatabaseReply({...reply,rows:[{id:0,name:"Main",values:[null]}]},request).status,"available");
});
test("RPC matches request ids and rejects outstanding requests on disconnect",async()=>{
  const sent=[];const rpc=createDatabaseRpc(line=>sent.push(line));
  const request={operation:"catalog",kind:1,start:0,limit:8};
  await assert.rejects(rpc.request(request),/未就绪/);rpc.enable();
  const first=rpc.request(request),second=rpc.request(request);
  rpc.accept({requestId:2,payload:{status:"unavailable",reason:"not_ready"}});
  assert.equal((await second).reason,"not_ready");
  const rejected=assert.rejects(first,/已关闭/);rpc.close();await rejected;
  assert.equal(sent[0],"catalog 1 1 0 8\n");
});
test("gold monitor uses catalog semantics and reads a generic cell, not a fixed amount",async()=>{
  const observations=[];
  const monitor=createGoldMonitor(async request=>request.operation==="catalog"
    ?{status:"available",kind:1,total:1,tables:[table(0)]}
    :{status:"available",kind:1,table:0,name:"パーティー情報",total:1,fieldCount:7,fields:[table().fields[0]],rows:[{id:0,name:"任意の行名",values:[9500]}]},value=>observations.push(value));
  monitor.start();await tick();monitor.stop();
  assert.equal(observations.at(-1).value,9500);
  assert.equal(observations.at(-1).source.mode,"auto");
});
test("gold monitor stops stale in-flight responses",async()=>{
  let release;const values=[];
  const monitor=createGoldMonitor(()=>new Promise(resolve=>{release=resolve;}),v=>values.push(v));
  monitor.start();monitor.stop();release({status:"available",kind:1,total:1,tables:[table()]});await tick();
  assert.deepEqual(values,[]);
});
