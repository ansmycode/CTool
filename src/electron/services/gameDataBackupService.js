import fs from "fs";
import path from "path";
import archiver from "archiver";
import extractZip from "extract-zip";
import { getTranslationEngineAdapter } from "./translationEngineAdapters.js";

const BACKUP_DIRECTORY_NAME = "CTool_Backups";
const BACKUP_FILE_PATTERN = /^data_backup_.+\.zip$/i;

function gameDirectory(gamePath) {
  if (typeof gamePath !== "string" || !gamePath) throw new Error("缺少游戏路径。");
  return path.dirname(gamePath);
}

function localTimestamp(date = new Date()) {
  const pad = (value, length = 2) => String(value).padStart(length, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}-${pad(date.getMilliseconds(), 3)}`;
}

function backupDirectory(gamePath) {
  return path.join(gameDirectory(gamePath), BACKUP_DIRECTORY_NAME);
}

function backupInfo(filePath, legacy = false) {
  const stat = fs.statSync(filePath);
  return {
    filePath,
    fileName: path.basename(filePath),
    createdAt: stat.mtime.toISOString(),
    displayTime: stat.mtime.toLocaleString("zh-CN", { hour12: false }),
    size: stat.size,
    legacy,
  };
}

function scanBackupDirectory(directory, legacy) {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && BACKUP_FILE_PATTERN.test(entry.name))
    .map((entry) => backupInfo(path.join(directory, entry.name), legacy));
}

function createZipFromDirectory(sourceDirectory, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => resolve(outputPath));
    output.on("error", reject);
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(sourceDirectory, false);
    archive.finalize();
  });
}

export function listGameDataBackups({ gamePath, engine }) {
  getTranslationEngineAdapter(engine);
  const gameDir = gameDirectory(gamePath);
  const directory = backupDirectory(gamePath);
  fs.mkdirSync(directory, { recursive: true });
  const backups = [
    ...scanBackupDirectory(directory, false),
    ...scanBackupDirectory(gameDir, true),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return { backupDirectory: directory, backups };
}

export function isKnownGameDataBackup(gameInfo, backupPath) {
  if (typeof backupPath !== "string" || !backupPath) return false;
  const resolved = path.resolve(backupPath).toLowerCase();
  return listGameDataBackups(gameInfo).backups.some(
    (item) => path.resolve(item.filePath).toLowerCase() === resolved,
  );
}

export async function createGameDataBackup(gameInfo, event) {
  const { gamePath, engine } = gameInfo;
  const adapter = getTranslationEngineAdapter(engine);
  const target = adapter.resolveTarget(gameDirectory(gamePath));
  const directory = backupDirectory(gamePath);
  fs.mkdirSync(directory, { recursive: true });
  const filePath = path.join(directory, `data_backup_${localTimestamp()}.zip`);

  event?.sender?.send("builtin-status", { status: "backup" });
  try {
    await createZipFromDirectory(target.path, filePath);
    const info = backupInfo(filePath);
    event?.sender?.send("builtin-status", { status: "backupend", data: info });
    return { backupDirectory: directory, backup: info };
  } catch (error) {
    if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
    throw error;
  }
}

export async function restoreGameDataBackup(gameInfo, selectedBackupPath, event) {
  const { gamePath, engine } = gameInfo;
  if (!isKnownGameDataBackup(gameInfo, selectedBackupPath)) {
    throw new Error("所选备份不属于当前游戏或已经不存在。");
  }

  const adapter = getTranslationEngineAdapter(engine);
  const target = adapter.resolveTarget(gameDirectory(gamePath));
  const parent = path.dirname(target.path);
  const token = `${process.pid}-${Date.now()}`;
  const extractedPath = path.join(parent, `.ctool-restore-${token}`);
  const previousPath = path.join(parent, `.ctool-before-restore-${token}`);
  let currentMoved = false;
  let restored = false;

  event?.sender?.send("builtin-status", { status: "restore" });
  try {
    fs.mkdirSync(extractedPath, { recursive: true });
    await extractZip(selectedBackupPath, { dir: extractedPath });
    adapter.validateRestore(extractedPath);

    fs.renameSync(target.path, previousPath);
    currentMoved = true;
    fs.renameSync(extractedPath, target.path);
    restored = true;

    try {
      fs.rmSync(previousPath, { recursive: true, force: true });
    } catch {
      // 还原已经完成；旧目录清理失败时保留临时目录，不回滚成功结果。
    }
    event?.sender?.send("builtin-status", { status: "restoreend" });
    return { success: true, backupPath: selectedBackupPath };
  } catch (error) {
    if (currentMoved && !restored && !fs.existsSync(target.path) && fs.existsSync(previousPath)) {
      fs.renameSync(previousPath, target.path);
    }
    throw error;
  } finally {
    if (fs.existsSync(extractedPath)) {
      fs.rmSync(extractedPath, { recursive: true, force: true });
    }
  }
}
