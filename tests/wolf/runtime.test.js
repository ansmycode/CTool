import test from "node:test";
import assert from "node:assert/strict";
import { validateRuntimeRequest, validateRuntimeReply } from "../../src/electron/wolf/runtimeProtocol.js";
import { createDatabaseRpc } from "../../src/electron/wolf/databaseProtocol.js";
import { createGameSessionService } from "../../src/electron/services/gameSessionService.js";

test("runtime protocol limits signed variables and excludes arbitrary memory/database commands", () => {
  const r={operation:"varwrite",group:2,index:99,expected:-2147483648,value:2147483647};
  assert.deepEqual(validateRuntimeRequest(r),[2,99,-2147483648,2147483647]);
  for(const patch of [{group:256},{index:-1},{index:100000},{value:2147483648},{value:1.5},{value:NaN},{expected:null}])
    assert.throws(()=>validateRuntimeRequest({...r,...patch}));
  for(const operation of ["goldwrite","inventorywrite","page","writeMemory","__proto__"])
    assert.throws(()=>validateRuntimeRequest({operation}));
  for(const value of [0,4.1,-1,Infinity,NaN,"2",null])assert.throws(()=>validateRuntimeRequest({operation:"speed",value}));
  assert.deepEqual(validateRuntimeRequest({operation:"speed",value:0.25}),[0.25]);
  assert.deepEqual(validateRuntimeRequest({operation:"noclip",value:false}),[0]);
  assert.throws(()=>validateRuntimeRequest({operation:"noclip",value:1}));
});

test("variable replies reject truncation, wrong identity and write acknowledgement mismatches", () => {
  const r={operation:"varpage",group:1,start:10,limit:2};
  const p={status:"available",group:1,total:12,rows:[{id:10,value:-1},{id:11,value:22}]};
  assert.equal(validateRuntimeReply(p,r),p);
  for(const patch of [{group:2},{rows:p.rows.slice(0,1)},{rows:[{id:0,value:1},{id:1,value:2}]},{total:9}])
    assert.throws(()=>validateRuntimeReply({...p,...patch},r));
  assert.throws(()=>validateRuntimeReply({status:"written",value:1},{operation:"varwrite",value:2}));
  assert.throws(()=>validateRuntimeReply({status:"written",value:"true"},{operation:"noclip",value:true}));
  assert.throws(()=>validateRuntimeReply({status:"available",groups:[{id:1,count:4}]},{operation:"varcatalog"}));
});

test("runtime shares request IDs with database RPC and closing rejects pending writes without retry", async () => {
  const sent=[];const rpc=createDatabaseRpc(text=>sent.push(text));rpc.enable();
  const first=rpc.request({operation:"speed",value:2});
  const second=rpc.request({operation:"varwrite",group:0,index:4,expected:1,value:-8});
  assert.deepEqual(sent,["speed 1 2\n","varwrite 2 0 4 1 -8\n"]);
  rpc.accept({requestId:2,payload:{status:"written",value:-8}});await second;
  const rejected=assert.rejects(first,/关闭/);rpc.close();await rejected;
  rpc.accept({requestId:1,payload:{status:"written",value:2}});
  assert.equal(sent.length,2);
});

test("runtime capabilities are session-bound, independent of database readiness, and revoked on failure",async()=>{
  let emit,complete,calls=0;
  const service=createGameSessionService({detect:async()=>({engine:"wolf",supported:true}),publish(){},createDriver:()=>({
    async launch(context){emit=context.emit;emit({type:"spawned",pid:1});emit({type:"connected",runtimeAvailable:true});},
    runtime(){calls++;return new Promise(resolve=>{complete=resolve;});},async dispose(){},detach(){},
  })});
  const s=await service.launch("test.exe");assert.equal(s.databaseReadOnly,false);assert.equal(s.runtimeAvailable,true);
  await assert.rejects(service.runtime("old",{operation:"speed",value:2}),/无效/);assert.equal(calls,0);
  const pending=service.runtime(s.sessionId,{operation:"speed",value:2});
  emit({type:"error",message:"lost"});assert.equal(service.snapshot().runtimeAvailable,false);
  complete({status:"written",value:2});await assert.rejects(pending,/已变化/);
  await assert.rejects(service.runtime(s.sessionId,{operation:"runtime"}),/无效/);
});

test("legacy DLL cannot expose runtime controls",async()=>{
  const service=createGameSessionService({detect:async()=>({engine:"wolf",supported:true}),publish(){},createDriver:()=>({
    async launch({emit}){emit({type:"spawned",pid:1});emit({type:"connected",databaseReadOnly:true});},
    runtime(){assert.fail("must not dispatch");},async dispose(){},detach(){},
  })});
  const s=await service.launch("test.exe");
  await assert.rejects(service.runtime(s.sessionId,{operation:"noclip",value:true}),/无效/);
});
