import { spawn } from "node:child_process";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createLineDecoder } from "../src/electron/wolf/helperProtocol.js";

const gameFlag = process.argv.indexOf("--game");
const nativeFlag=process.argv.indexOf("--native-dir");
const nativeDir=path.resolve(nativeFlag>=0?process.argv[nativeFlag+1]:"native/build/Release");
const game = path.resolve(gameFlag >= 0 ? process.argv[gameFlag + 1] : path.join(nativeDir,"wolf-fixture.exe"));
const dll = path.join(nativeDir,"ctool-wolf-x86.dll");
const exe = path.join(nativeDir,"inject-x86.exe");
const sessionId = randomUUID(), nonce = randomBytes(24).toString("hex");
const before = createHash("sha256").update(fs.readFileSync(game)).digest("hex");
let ready = false, closed = false, databaseReported = false, writeRejected = false, pid, failure, timer;
const child = spawn(exe, [game, dll, sessionId, nonce], { windowsHide: true,
  cwd: path.dirname(game), stdio: ["pipe", "pipe", "pipe"] });
child.stdin.on("error", () => {});
const timeout = setTimeout(() => {
  failure ??= new Error("Smoke timeout: close the reported game PID manually if it remains open.");
  child.stdin.end("detach\n");
}, 45000);
child.stdout.on("data", createLineDecoder((message) => {
  if (message.type === "spawned") pid = message.pid;
  if (message.type !== "heartbeat") console.log(JSON.stringify({
    type: message.type, pid: message.pid, message: message.message, capabilities: message.capabilities,
    status: message.status, value: message.value, reason: message.reason, payload:message.payload,
  }));
  if (message.type === "hello") {
    assert.equal(message.sessionId, sessionId); assert.equal(message.nonce, nonce);
    assert.equal(message.protocolVersion, 1); assert.equal(message.pid, pid);
    assert.deepEqual(message.capabilities, []);
    ready = true;
    assert.equal(message.databaseProtocol,1);
    assert.equal(message.goldWriteProtocol,1);
    child.stdin.write("catalog 1 1 0 8\n");
    // Close only windows belonging to the game created by this invocation.
    timer = setTimeout(() => child.stdin.write("close\n"), gameFlag >= 0 ? 8000 : 1500);
  }
  if (message.type === "exited") closed = true;
  if (message.type === "rpc") {
    assert.equal(message.sessionId,sessionId);assert.equal(message.nonce,nonce);assert.equal(message.pid,pid);
    databaseReported=true;
    if(message.requestId===1){
      if(gameFlag<0){assert.equal(message.payload.status,"unavailable","fixture must not report fake database");child.stdin.write("goldwrite 2 1 0 0 0 0 123\n");}
    }else{
      assert.equal(message.requestId,2);assert.equal(gameFlag,-1);
      assert.equal(message.payload.status,"unavailable","fixture must reject write without database");writeRejected=true;
    }
  }
  if (message.type === "error") failure = new Error(message.message);
}, (error) => { failure = error; child.stdin.end("detach\n"); }));
child.stderr.on("data", (data) => process.stderr.write(data));
try {
  const code = await new Promise((resolve, reject) => { child.on("exit", resolve); child.on("error", reject); });
  if (failure) throw failure;
  assert.equal(code, 0); assert.ok(ready, "DLL hello"); assert.ok(closed, "actual game exit");
  assert.ok(databaseReported,"DLL bidirectional database reply (including unsupported status)");
  if(gameFlag<0)assert.ok(writeRejected,"unsupported write request rejected");
  assert.equal(createHash("sha256").update(fs.readFileSync(game)).digest("hex"), before, "Game.exe unchanged");
  console.log("PASS: x86 launch, DLL handshake, graceful game exit, EXE unchanged");
} finally { clearTimeout(timer); clearTimeout(timeout); }
