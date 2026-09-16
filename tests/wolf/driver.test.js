import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { createWolfDriver } from "../../src/electron/engines/wolfDriver.js";
import { detectGame } from "../../src/electron/services/gameDetectionService.js";
function pe(dll=false) {
  const b=Buffer.alloc(512); b.writeUInt16LE(0x5a4d); b.writeUInt32LE(64,60);
  b.writeUInt32LE(0x4550,64); b.writeUInt16LE(0x14c,68); b.writeUInt16LE(dll?0x2000:0,86);
  b.write("WOLF RPG Editor",256,"utf16le"); return b;
}
const tick = () => new Promise(resolve=>setImmediate(resolve));

test("authenticated driver routes bound gold writes and blocks write through browse API",async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"ctool-write-driver-"));let driver;
  try{
    fs.writeFileSync(path.join(root,"inject-x86.exe"),pe());fs.writeFileSync(path.join(root,"ctool-wolf-x86.dll"),pe(true));
    const child=Object.assign(new EventEmitter(),{stdin:new PassThrough(),stdout:new PassThrough(),stderr:new PassThrough()});
    let identity;let amount=8500;const events=[];const commands=[];
    const fields=[{id:0,name:"所持金",type:"number"},...Array.from({length:6},(_,i)=>({id:i+1,name:`メンバー${i+1}`,type:"number"}))];
    const send=m=>child.stdout.write(JSON.stringify(m)+"\n");
    child.stdin.on("data",chunk=>{
      const [op,id,...args]=String(chunk).trim().split(" ");if(op==="detach")return;commands.push(op);
      let payload;
          if(op==="catalog")payload={status:"available",kind:1,total:1,tables:[{id:0,name:"パーティー情報",rowCount:1,fieldCount:7,fields}]};
      else if(op==="page")payload={status:"available",kind:1,table:0,name:"パーティー情報",total:1,fieldCount:7,fields:[fields[0]],rows:[{id:0,name:"Main",values:[amount]}]};
      else{assert.ok(["goldwrite","inventorywrite"].includes(op));assert.equal(Number(args[4]),amount);amount=Number(args[5]);payload={status:"written",value:amount};}
      queueMicrotask(()=>send({...identity,type:"rpc",requestId:Number(id),payload}));
    });
    driver=createWolfDriver({resourceDirectory:root,spawnProcess:(_exe,args)=>{
      identity={sessionId:args[2],nonce:args[3],protocolVersion:1,pid:123};
          queueMicrotask(()=>{send({type:"spawned",pid:123});send({...identity,type:"hello",databaseProtocol:1,goldWriteProtocol:1,inventoryWriteProtocol:1});});return child;
    }});
    await driver.launch({game:{gamePath:"Game.exe"},sessionId:"write-session",emit:e=>events.push(e)});await tick();
    assert.equal(events.find(e=>e.type==="connected").goldWritable,true);
    await assert.rejects(driver.readDatabase({operation:"goldwrite"}),/仅允许读取/);
    await driver.setGold(9000,{value:8500,source:{kind:1,table:0,row:0,field:0}});
    assert.equal(amount,9000);assert.equal(events.at(-1).gold.value,9000);
    assert.equal(commands.filter(op=>op==="goldwrite").length,1);
    await driver.setInventoryCount({kind:1,table:7,row:3,field:0},9000,2);
    assert.equal(amount,2);assert.equal(commands.filter(op=>op==="inventorywrite").length,1);
    send({type:"exited"});await assert.rejects(driver.setGold(1,{value:9000,source:{kind:1,table:0,row:0,field:0}}),/未就绪/);
  }finally{await driver?.dispose();fs.rmSync(root,{recursive:true,force:true});}
});
test("Wolf detection allows new x86 EXEs without a hash allowlist but rejects x64 and DLL", () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"ctool-detect-"));
  try {
    fs.mkdirSync(path.join(root,"Data","BasicData"),{recursive:true});
    fs.writeFileSync(path.join(root,"Game.exe"),pe());
    const info=detectGame(path.join(root,"Game.exe"));
    assert.equal(info.engine,"wolf"); assert.equal(info.architecture,"x86"); assert.equal(info.supported,true);
    assert.equal(info.profileId,undefined);
    const x64=pe(); x64.writeUInt16LE(0x8664,68);
    fs.writeFileSync(path.join(root,"GamePro.exe"),x64);
    assert.equal(detectGame(path.join(root,"GamePro.exe")).supported,false);
    fs.writeFileSync(path.join(root,"GamePro.exe"),pe(true));
    assert.equal(detectGame(path.join(root,"GamePro.exe")).supported,false);
    fs.writeFileSync(path.join(root,"GamePro.exe"),pe());
    assert.equal(detectGame(path.join(root,"GamePro.exe")).supported,true);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
test("Wolf helper authenticates session/nonce/PID and rejects wrong nonce", async () => {
  for(const valid of [true,false]) {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),"ctool-driver-"));
    let driver;
    try {
      fs.writeFileSync(path.join(root,"inject-x86.exe"),pe());
      fs.writeFileSync(path.join(root,"ctool-wolf-x86.dll"),pe(true));
      const child=Object.assign(new EventEmitter(),{
        stdin:new PassThrough(),stdout:new PassThrough(),stderr:new PassThrough(),
      });
      const events=[];
      driver=createWolfDriver({resourceDirectory:root,spawnProcess:(_exe,args)=>{
        queueMicrotask(()=>{
          child.stdout.write(JSON.stringify({type:"spawned",pid:123})+"\n");
          child.stdout.write(JSON.stringify({type:"hello",pid:123,protocolVersion:1,
            sessionId:args[2],nonce:valid?args[3]:"invalid",capabilities:[]})+"\n");
        });
        return child;
      }});
      await driver.launch({game:{gamePath:path.join(root,"Game.exe")},sessionId:"test",emit:e=>events.push(e)});
      await tick();
      assert.equal(events.some(e=>e.type==="connected"),valid);
      assert.equal(events.some(e=>e.type==="error"),!valid);
      if(valid) {
        child.stdout.write('{"type":"exited","pid":123}\n');
        await tick(); assert.equal(events.at(-1).type,"exited");
      }
    } finally { await driver?.dispose(); fs.rmSync(root,{recursive:true,force:true}); }
  }
});

test("gold telemetry requires authentication and validates int32 values", async () => {
  for (const mode of ["valid", "bad-nonce", "overflow", "before-hello"]) {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),"ctool-gold-"));
    let driver;
    try {
      fs.writeFileSync(path.join(root,"inject-x86.exe"),pe());
      fs.writeFileSync(path.join(root,"ctool-wolf-x86.dll"),pe(true));
      const child=Object.assign(new EventEmitter(),{stdin:new PassThrough(),stdout:new PassThrough(),stderr:new PassThrough()});
      const events=[];
      driver=createWolfDriver({resourceDirectory:root,spawnProcess:(_exe,args)=>{
        queueMicrotask(()=>{
          const identity={sessionId:args[2],nonce:args[3],protocolVersion:1,pid:321};
          const send=m=>child.stdout.write(JSON.stringify(m)+"\n");
          send({type:"spawned",pid:321});
          if(mode!=="before-hello")send({...identity,type:"hello",capabilities:[]});
          send({...identity,type:"gold",status:"available",value:mode==="overflow"?2147483648:9500,
            nonce:mode==="bad-nonce"?"bad":identity.nonce});
          if(mode==="valid")send({...identity,type:"gold",status:"unavailable",reason:"database_not_ready"});
        });return child;
      }});
      await driver.launch({game:{gamePath:"test.exe"},sessionId:"gold-test",emit:e=>events.push(e)});
      await tick();
      const telemetry=events.filter(e=>e.type==="telemetry");
      assert.equal(telemetry.length,mode==="valid"?2:0);
      assert.equal(events.some(e=>e.type==="error"),mode!=="valid");
      if(mode==="valid"){
        assert.equal(telemetry[0].gold.value,9500);
        assert.equal(telemetry[1].gold.status,"unavailable");
        assert.equal("value" in telemetry[1].gold,false);
      }
    } finally {await driver?.dispose();fs.rmSync(root,{recursive:true,force:true});}
  }
});
test("missing native resources fail before spawning any process", async () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"ctool-missing-"));
  try {
    const driver=createWolfDriver({resourceDirectory:root,spawnProcess:()=>{throw new Error("must not spawn");}});
    await assert.rejects(driver.launch({game:{gamePath:"test.exe"},sessionId:"s",emit(){}}),/build:native/);
    await driver.dispose();
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
