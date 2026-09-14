import test from "node:test";
import assert from "node:assert/strict";
import { createGameSessionService } from "../../src/electron/services/gameSessionService.js";
const game = { gamePath: "test.exe", engine: "wolf", supported: true };
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("read-only telemetry updates the session and is cleared on failure and exit", async () => {
  const h=harness(async ({emit})=>{emit({type:"spawned",pid:123});emit({type:"connected",message:"ok"});});
  await h.service.launch("test.exe");
  const gold={status:"available",value:9500,observedAt:123};
  h.emit({type:"telemetry",gold});
  assert.deepEqual(h.service.snapshot().telemetry,{gold});
  assert.deepEqual(h.service.snapshot().capabilities,[]);
  h.emit({type:"error",message:"lost"});
  assert.equal(h.service.snapshot().telemetry,undefined);
  h.emit({type:"telemetry",gold});
  assert.equal(h.service.snapshot().telemetry,undefined);
  h.emit({type:"exited"});await tick();
  assert.equal(h.service.snapshot().telemetry,undefined);
});
function harness(launch) {
  const events = []; let emit, disposed = 0;
  const service = createGameSessionService({
    detect: async () => game, publish: (snapshot) => events.push(snapshot),
    createDriver: () => ({
      async launch(context) { emit = context.emit; await launch(context); },
      async dispose() { disposed++; }, detach() {},
    }),
  });
  return { service, events, emit: (event) => emit(event), disposed: () => disposed };
}
test("ready before launch response is retained; duplicate launch rejected", async () => {
  const h = harness(async ({ emit }) => {
    emit({ type: "spawned", pid: 123 }); emit({ type: "connected", message: "connected" });
  });
  const snapshot = await h.service.launch("test.exe");
  assert.equal(snapshot.state, "degraded");
  assert.deepEqual(snapshot.capabilities, []);
  await assert.rejects(h.service.launch("test.exe"), /已有游戏/);
  assert.ok(h.events.every((e,i,a) => !i || e.revision > a[i-1].revision));
});
test("exit finalized once and old callbacks cannot mutate next session", async () => {
  let oldEmit;
  const h = harness(async ({ emit }) => { oldEmit ??= emit; emit({ type: "spawned", pid: 123 }); });
  await h.service.launch("test.exe");
  h.emit({ type: "exited" }); h.emit({ type: "exited" });
  await tick(); assert.equal(h.disposed(), 1); assert.equal(h.service.snapshot().state, "closed");
  const next = await h.service.launch("test.exe");
  oldEmit({ type: "connected", message: "stale" });
  assert.deepEqual(h.service.snapshot(), next);
});
test("pre-launch failure allows retry", async () => {
  const h = harness(async () => { throw new Error("missing DLL"); });
  assert.equal((await h.service.launch("test.exe")).state, "failed");
  assert.equal((await h.service.launch("test.exe")).state, "failed");
});
test("communication failure does not falsely report running game as exited", async () => {
  const h = harness(async ({ emit }) => { emit({ type: "spawned", pid: 123 }); });
  await h.service.launch("test.exe");
  h.emit({ type: "error", message: "pipe failed" });
  assert.equal(h.service.snapshot().processState, "running");
  assert.equal(h.service.snapshot().state, "failed");
  await assert.rejects(h.service.launch("test.exe"));
});
test("Wolf ignores legacy MV/MZ ready callback", async () => {
  const h = harness(async ({ emit }) => { emit({ type: "spawned", pid: 123 }); });
  await h.service.launch("test.exe");
  h.service.markMvmzReady();
  assert.equal(h.service.snapshot().state, "connecting");
});
test("MV/MZ ready snapshot exposes existing features", async () => {
  const service = createGameSessionService({ detect: async () => ({...game, engine:"MV"}),
    publish() {}, createDriver: () => ({async launch({emit}) {emit({type:"spawned",pid:1});},async dispose(){}}) });
  await service.launch("test.exe"); service.markMvmzReady();
  assert.equal(service.snapshot().state,"ready");
  assert.ok(service.snapshot().capabilities.includes("actors"));
});

test("database API rejects stale sessions and discards replies after exit",async()=>{
  let emit,resolveRead;
  const service=createGameSessionService({detect:async()=>game,publish(){},createDriver:()=>({
    async launch(context){emit=context.emit;emit({type:"spawned",pid:123});emit({type:"connected",databaseReadOnly:true});},
    readDatabase(){return new Promise(resolve=>{resolveRead=resolve;});},async dispose(){},selectGoldSource(){},
  })});
  const session=await service.launch("test.exe");
  await assert.rejects(service.readDatabase("old",{}),/无效/);
  const pending=service.readDatabase(session.sessionId,{});
  emit({type:"exited"});await tick();resolveRead({status:"available"});
  await assert.rejects(pending,/已变化/);
  assert.throws(()=>service.selectGoldSource(session.sessionId,null),/无效/);
});

test("gold writes require current writable session and discard acknowledgements after failure",async()=>{
  let emit,complete;let calls=0;
  const service=createGameSessionService({detect:async()=>game,publish(){},createDriver:()=>({
    async launch(context){emit=context.emit;emit({type:"spawned",pid:123});emit({type:"connected",databaseReadOnly:true,goldWritable:true});},
    setGold(){calls++;return new Promise(resolve=>{complete=resolve;});},async dispose(){},
  })});
  const session=await service.launch("test.exe");
  await assert.rejects(service.setGold("old",1,{}),/无效/);assert.equal(calls,0);
  const pending=service.setGold(session.sessionId,10000,{});
  emit({type:"error",message:"disconnected"});complete();await assert.rejects(pending,/未确认/);
  assert.equal(service.snapshot().goldWritable,false);
  await assert.rejects(service.setGold(session.sessionId,1,{}),/无效/);assert.equal(calls,1);
});
