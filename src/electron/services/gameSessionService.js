import { randomUUID } from "node:crypto";

const mvmzCapabilities = ["overview", "items", "armors", "weapons", "variables", "switches", "actors", "translation"];
export function createGameSessionService({ detect, createDriver, publish, saveHistory = () => {} }) {
  let current = null;
  let revision = 0;
  const snapshot = () => current ? structuredClone(current.snapshot) : null;
  const update = (entry, patch) => {
    if (current !== entry || entry.finalized) return;
    entry.snapshot = { ...entry.snapshot, ...patch, revision: ++revision };
    publish(snapshot());
  };
  const finish = async (entry) => {
    if (current !== entry || entry.finalized || entry.finishing) return;
    entry.finishing = true;
    let cleanupError;
    try { await entry.driver?.dispose(); } catch (error) { cleanupError = error.message; }
    update(entry, { state: "closed", processState: "exited", capabilities: [], telemetry: undefined,databaseReadOnly:false,goldWritable:false,
      message: cleanupError ? "游戏已退出，但清理失败：" + cleanupError : "游戏已退出" });
    entry.finalized = true;
  };
  return {
    snapshot,
    async launch(exePath) {
      if (current && !current.finalized) throw new Error("已有游戏会话，请先关闭当前游戏");
      const entry = { snapshot: { sessionId: randomUUID(), revision: ++revision,
        state: "launching", processState: "starting", capabilities: [], message: "正在检测游戏" } };
      current = entry; publish(snapshot());
      try {
        const game = await detect(exePath);
        if (!game?.supported) throw new Error(game?.supportMessage || "不支持的游戏");
        entry.snapshot.game = game;
        entry.driver = createDriver(game.engine);
        await entry.driver.launch({
          game, sessionId: entry.snapshot.sessionId,
          emit(event) {
            if (current !== entry || entry.finalized || entry.finishing) return;
            if (event.type === "spawned") {
              update(entry, { pid: event.pid, processState: "running", state: "connecting", message: "游戏已启动，等待连接" });
              try { saveHistory(game); } catch { /* History must not invalidate a running game. */ }
            } else if (event.type === "injected") {
              if (entry.snapshot.state === "connecting") update(entry, { state: "initializing", message: "DLL 已加载，等待握手" });
            } else if (event.type === "connected") {
              update(entry, { state: "degraded", capabilities: [],databaseReadOnly:!!event.databaseReadOnly,goldWritable:!!event.goldWritable, message: event.message });
            } else if (event.type === "telemetry") {
              if (entry.snapshot.state === "degraded" && entry.snapshot.processState === "running")
                update(entry, { telemetry: { gold: event.gold } });
            } else if (event.type === "error") {
              update(entry, { state: "failed", capabilities: [], telemetry: undefined,databaseReadOnly:false,goldWritable:false, message: event.message });
            } else if (event.type === "exited") void finish(entry);
          },
        });
        return snapshot();
      } catch (error) {
        update(entry, { state: "failed", capabilities: [], message: error.message });
        if (entry.snapshot.processState !== "running") {
          await entry.driver?.dispose();
          entry.finalized = true;
        }
        return snapshot();
      }
    },
    markMvmzReady() {
      if (!current || current.finalized || !["MV", "MZ"].includes(current.snapshot.game?.engine) ||
          current.snapshot.processState !== "running") return;
      update(current, { state: "ready", capabilities: mvmzCapabilities, message: "游戏已就绪" });
    },
    async readDatabase(sessionId,request) {
      const entry=current;
      if(!entry||entry.finalized||entry.snapshot.sessionId!==sessionId||!entry.snapshot.databaseReadOnly||!entry.driver.readDatabase)
        throw new Error("数据库会话无效或未就绪");
      const result=await entry.driver.readDatabase(request);
      if(current!==entry||entry.finalized||!entry.snapshot.databaseReadOnly)throw new Error("游戏会话已变化");
      return result;
    },
    selectGoldSource(sessionId,target) {
      if(!current||current.finalized||current.snapshot.sessionId!==sessionId||!current.snapshot.databaseReadOnly||!current.driver.selectGoldSource)
        throw new Error("数据库会话无效或未就绪");
      current.driver.selectGoldSource(target);
      update(current,{telemetry:{gold:{status:"unavailable",reason:"gold_source_switching"}}});
    },
    async setGold(sessionId,value,expectation) {
      const entry=current;
      if(!entry||entry.finalized||entry.finishing||entry.snapshot.sessionId!==sessionId||!entry.snapshot.goldWritable||!entry.snapshot.databaseReadOnly||!entry.driver.setGold)
        throw new Error("金币修改会话无效或未就绪");
      await entry.driver.setGold(value,expectation);
      if(current!==entry||entry.finalized||entry.finishing||!entry.snapshot.goldWritable)throw new Error("会话已变化，修改结果未确认");
    },
    dispose() { current?.driver?.detach(); },
  };
}
