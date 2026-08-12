//游戏引擎检测

import { detectAndReadInfo } from "../../utils/gameUtil.js";

let gameInfo;

export function detectGame(exePath) {
  gameInfo = detectAndReadInfo(exePath);
  return gameInfo;
}
