import fs from "node:fs";
import path from "node:path";
import { detectAndReadInfo } from "../../utils/gameUtil.js";
import { detectWolf } from "../../engine/wolf/detect.js";

export function detectGame(exePath) {
  if (typeof exePath !== "string" || !path.isAbsolute(exePath) ||
      path.extname(exePath).toLowerCase() !== ".exe" || !fs.statSync(exePath).isFile())
    throw new Error("请选择有效的游戏 EXE");
  const gamePath = fs.realpathSync(exePath);
  const mvmz = detectAndReadInfo(gamePath);
  if (mvmz.engine === "MV" || mvmz.engine === "MZ") return { ...mvmz, supported: true };
  return detectWolf(gamePath) ?? { gamePath, title: path.basename(gamePath), engine: null,
    version: "未知", supported: false, supportMessage: "暂不支持或无法识别该游戏" };
}
