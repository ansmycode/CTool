import { app } from "electron";
import path from "node:path";
import { createMvmzDriver } from "./mvmzDriver.js";
import { createWolfDriver } from "./wolfDriver.js";

export function createEngineDriver(engine) {
  if (engine === "MV" || engine === "MZ") return createMvmzDriver();
  if (engine === "wolf") return createWolfDriver({
    resourceDirectory: app.isPackaged
      ? path.join(process.resourcesPath, "native", "wolf", "x86")
      : path.join(app.getAppPath(), "native", "build", "Release"),
  });
  throw new Error("不支持的游戏引擎");
}

