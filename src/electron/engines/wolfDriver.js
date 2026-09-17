import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createLineDecoder } from "../wolf/helperProtocol.js";
import { readPE } from "../../engine/wolf/detect.js";
import { createDatabaseRpc } from "../wolf/databaseProtocol.js";
import { createGoldMonitor } from "../wolf/goldMonitor.js";
import { tableCategory } from "../wolf/databaseSemantics.js";
import { discoverCollections } from "../../engine/wolf/databaseMapping.js";

export function createWolfDriver({ resourceDirectory, spawnProcess = spawn }) {
  let child;
  let timer;
  let exitMonitor;
  let goldMonitor;
  let goldWritable=false;
  let inventoryWritable=false;
  const databaseRpc=createDatabaseRpc(command=>{
    if(!child?.stdin.writable)throw new Error("注入器输入已关闭");
    child.stdin.write(command);
  });
  const catalog = async (kind) => {
    const tables=[];
    for(let start=0;start<4096;){
      const result=await databaseRpc.request({operation:"catalog",kind,start,limit:8});
      if(result.status!=="available")throw new Error(`数据库目录不可读：${result.reason||"unknown"}`);
      tables.push(...result.tables);
      if(start+result.tables.length>=result.total)return tables;
      if(!result.tables.length)throw new Error("数据库目录不完整");
      start+=result.tables.length;
    }
    throw new Error("数据库目录超出范围");
  };
  const resolveInventoryRecord = async (reference) => {
    if(!reference||typeof reference.collectionKey!=="string"||reference.collectionKey.length>256||
       !Number.isInteger(reference.itemId)||reference.itemId<0||reference.itemId>99999)
      throw new Error("无效背包记录");
    // Recreate the semantic binding in the main process immediately before a
    // write. The renderer provides an item identity only, never a raw table
    // coordinate that could be redirected with developer tools.
    const [userTables,variableTables]=await Promise.all([catalog(0),catalog(1)]);
    const collection=discoverCollections(userTables,variableTables)
      .find(item=>item.key===reference.collectionKey);
    const binding=collection?.quantityBinding;
    if(!collection?.writable||!binding)
      throw new Error("背包数量映射未确认，已拒绝写入");
    if(reference.itemId>=binding.rowCount)
      throw new Error("该物品尚无可写的运行时数量记录");
    return {kind:binding.kind,table:binding.table,row:reference.itemId,field:binding.field};
  };
  return {
    async launch({ game, sessionId, emit }) {
      const exe = path.join(resourceDirectory, "inject-x86.exe");
      const dll = path.join(resourceDirectory, "ctool-wolf-x86.dll");
      for (const [file, isDll] of [[exe, false], [dll, true]]) {
        if (!fs.existsSync(file)) throw new Error("缺少 Wolf 原生组件，请先运行 npm run build:native");
        const pe = readPE(fs.readFileSync(file));
        if (pe.architecture !== "x86" || pe.isDll !== isDll) throw new Error("Wolf 原生组件架构错误");
      }
      const nonce = randomBytes(24).toString("hex");
      let pid, authenticated = false, exited = false, reportedFailure = false;
      const fail = (error) => {
        if (reportedFailure || exited) return;
        reportedFailure = true;
        clearTimeout(timer);
        goldMonitor?.stop();databaseRpc.close();
        emit({ type: "error", message: error.message });
      };
      const deadline = () => {
        clearTimeout(timer);
        timer = setTimeout(() => fail(new Error("Wolf DLL 连接或心跳超时")), 20000);
        timer.unref?.();
      };
      await new Promise((resolve, reject) => {
        child = spawnProcess(exe, [game.gamePath, dll, sessionId, nonce], {
          cwd: path.dirname(game.gamePath), windowsHide: true, stdio: ["pipe", "pipe", "pipe"],
        });
        child.stdin.on("error", () => {});
        child.stderr.on("data", () => {}); // stdout alone carries structured diagnostics
        child.stdout.on("data", createLineDecoder((message) => {
          if (exited) return;
          if (message.type === "spawned") {
            if (pid || !Number.isInteger(message.pid) || message.pid <= 0) throw new Error("无效游戏 PID");
            pid = message.pid; emit({ type: "spawned", pid }); resolve(); return;
          }
          if (["hello", "heartbeat", "gold", "rpc"].includes(message.type)) {
            if (message.sessionId !== sessionId || message.nonce !== nonce ||
                message.protocolVersion !== 1 || message.pid !== pid)
              throw new Error("Wolf 握手验证失败");
            if (message.type !== "hello" && !authenticated) throw new Error("握手前收到运行时数据");
            if(message.type==="rpc") {if(!reportedFailure)databaseRpc.accept(message);return;}
            if (message.type === "gold") {
              if (!["available", "unavailable"].includes(message.status) ||
                  (message.status === "available" && (!Number.isInteger(message.value) ||
                    message.value < -2147483648 || message.value > 2147483647)))
                throw new Error("无效金币数据");
              if (!reportedFailure) emit({ type: "telemetry", gold: message.status === "available"
                ? { status: "available", value: message.value, observedAt: Date.now() }
                : { status: "unavailable", reason: String(message.reason ?? "unknown").slice(0,128) } });
              return;
            }
            deadline();
            if (!authenticated) {
              authenticated = true;
              goldWritable=message.databaseProtocol===1&&message.goldWriteProtocol===1;
              inventoryWritable=message.databaseProtocol===1&&message.inventoryWriteProtocol===1;
              emit({ type: "connected", capabilities: [], goldWritable, inventoryWritable, databaseReadOnly:message.databaseProtocol===1,
                message: message.databaseProtocol===1 ? (goldWritable?"DLL 已连接；数据库浏览与金币修改已开启":"DLL 已连接；数据库只读浏览与自动识别已开启") : "DLL 已连接；请重新编译 DLL 以使用数据库浏览" });
              if(message.databaseProtocol===1){
                databaseRpc.enable();
                goldMonitor=createGoldMonitor(request=>databaseRpc.request(request),gold=>emit({type:"telemetry",gold}));
                goldMonitor.start();
              }
            }
          } else if (message.type === "exited") {
            exited = true; clearTimeout(timer);goldMonitor?.stop();databaseRpc.close(); emit({ type: "exited" });
          } else if (message.type === "error") {
            const error = new Error(String(message.message));
            fail(error); reject(error);
          } else if (message.type === "injected") {
            emit({ type: "injected" });
          } else throw new Error("未知注入器消息");
        }, (error) => { fail(error); reject(error); }));
        child.once("error", (error) => { fail(error); reject(error); });
        child.once("exit", (code) => {
          clearTimeout(timer);
          if (!exited) {
            const error = new Error(`注入器已退出（${code}），游戏状态需确认`);
            fail(error); reject(error);
            // If the helper crashes, do not confuse its exit with the game's exit.
            // Retain the session until this PID no longer exists (conservative on PID reuse).
            if (pid) {
              exitMonitor = setInterval(() => {
                try { process.kill(pid, 0); }
                catch (error) {
                  if (error.code === "ESRCH") {
                    clearInterval(exitMonitor); exited = true; emit({ type: "exited" });
                  }
                }
              }, 1000);
              exitMonitor.unref?.();
            }
          }
        });
        deadline();
      });
    },
    async readDatabase(request) {
      if(!["catalog","page"].includes(request?.operation))throw new Error("数据库浏览仅允许读取");
      const result=await databaseRpc.request(request);
      if(result.status==="available"&&request.operation==="catalog")
        return {...result,tables:result.tables.map(t=>({...t,category:tableCategory(t,request.kind)}))};
      return result;
    },
    selectGoldSource(target){if(!goldMonitor)throw new Error("数据库监测未就绪");goldMonitor.select(target);},
    refreshTelemetry(){goldMonitor?.refresh();},
    async setGold(value,expectation){if(!goldWritable||!goldMonitor)throw new Error("DLL 不支持金币修改，请更新并重启游戏");await goldMonitor.write(value,expectation);},
    async setInventoryCount(reference,expected,value){
      if(!inventoryWritable)throw new Error("DLL 不支持背包数量修改，请更新并重启游戏");
      const target=await resolveInventoryRecord(reference);
      const result=await databaseRpc.request({operation:"inventorywrite",...target,expected,value});
      if(result.status!=="written")throw new Error(result.reason||"背包数量写入失败");
    },
    async dispose() {goldMonitor?.stop();databaseRpc.close(); clearTimeout(timer); clearInterval(exitMonitor); child?.stdin.end("detach\n"); },
    detach() {goldMonitor?.stop();databaseRpc.close(); clearTimeout(timer); clearInterval(exitMonitor); child?.stdin.end("detach\n"); },
  };
}
