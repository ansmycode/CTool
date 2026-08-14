import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createGameDataBackup,
  listGameDataBackups,
  restoreGameDataBackup,
} from "../../src/electron/services/gameDataBackupService.js";

function createFakeGame() {
  const gameDir = fs.mkdtempSync(path.join(os.tmpdir(), "ctool-backup-"));
  const gamePath = path.join(gameDir, "Game.exe");
  const dataPath = path.join(gameDir, "www", "data");
  fs.mkdirSync(dataPath, { recursive: true });
  fs.writeFileSync(gamePath, "");
  fs.writeFileSync(
    path.join(dataPath, "System.json"),
    JSON.stringify({ gameTitle: "原始标题" }),
  );
  return { gameDir, gamePath, dataPath, engine: "MZ" };
}

test("MV/MZ 备份保存在游戏 CTool_Backups 目录并可还原", async () => {
  const game = createFakeGame();
  try {
    const created = await createGameDataBackup(game);
    assert.equal(path.dirname(created.backup.filePath), path.join(game.gameDir, "CTool_Backups"));
    assert.match(created.backup.fileName, /^data_backup_.+\.zip$/);

    const listed = listGameDataBackups(game);
    assert.equal(listed.backups.length, 1);
    fs.writeFileSync(
      path.join(game.dataPath, "System.json"),
      JSON.stringify({ gameTitle: "修改后的标题" }),
    );
    fs.writeFileSync(path.join(game.dataPath, "Extra.json"), "{}");

    await restoreGameDataBackup(game, created.backup.filePath);
    const restored = JSON.parse(
      fs.readFileSync(path.join(game.dataPath, "System.json"), "utf8"),
    );
    assert.equal(restored.gameTitle, "原始标题");
    assert.equal(fs.existsSync(path.join(game.dataPath, "Extra.json")), false);
  } finally {
    fs.rmSync(game.gameDir, { recursive: true, force: true });
  }
});

test("不支持的引擎会在备份前明确拒绝", async () => {
  await assert.rejects(
    () => createGameDataBackup({ gamePath: "D:\\Game\\Game.exe", engine: "WOLF" }),
    /当前不支持 WOLF 引擎/,
  );
});
