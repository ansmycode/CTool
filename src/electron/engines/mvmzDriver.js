import path from "node:path";
import { spawn } from "node:child_process";
import { injectMVMZ, cleanupMVMZInjection } from "../../engine/mvmz/injectScript.js";

export function createMvmzDriver() {
  let injection;
  return {
    async launch({ game, emit }) {
      injection = await injectMVMZ(path.dirname(game.gamePath));
      await new Promise((resolve, reject) => {
        const child = spawn(game.gamePath, [], { cwd: path.dirname(game.gamePath), detached: true });
        child.once("spawn", () => { emit({ type: "spawned", pid: child.pid }); resolve(); });
        child.once("error", reject);
        child.once("exit", (code) => emit({ type: "exited", code }));
      });
    },
    async dispose() {
      if (injection) { const current = injection; injection = null; await cleanupMVMZInjection(current); }
    },
    // App shutdown must not remove plugins while the game is still running.
    detach() {},
  };
}

