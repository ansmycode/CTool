//读取、保存和删除历史记录
import {
  deleteGameHistory,
  readGameHistory,
  saveGameHistory,
} from "../../utils/tool.js";

export function readHistory() {
  return readGameHistory();
}

export function saveHistory(gameInfo) {
  saveGameHistory(gameInfo);
}

export function deleteHistory(gamePath) {
  return deleteGameHistory(gamePath);
}
