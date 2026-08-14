import crypto from "crypto";
import fs from "fs";
import path from "path";

const VALID_STATUSES = new Set([
  "untranslated",
  "translated",
  "skipped",
  "error",
]);

function readSourceJson(sourcePath) {
  const content = fs.readFileSync(sourcePath, "utf8");
  const source = JSON.parse(content);
  if (!source || Array.isArray(source) || typeof source !== "object") {
    throw new Error("原始翻译 JSON 必须是键值对象。");
  }
  return { source, content };
}

function classifySourceItem(key, value) {
  if (typeof value !== "string" || value.length === 0) {
    return {
      value: typeof value === "string" && value.length > 0 ? value : key,
      status: "error",
      error: "原始 JSON 的 value 必须是非空字符串",
    };
  }
  if (value === key) return { value, status: "untranslated" };
  return { value, status: "translated" };
}

function isReusableWorkItem(item) {
  return (
    item &&
    typeof item === "object" &&
    typeof item.value === "string" &&
    VALID_STATUSES.has(item.status)
  );
}

function mergeItems(source, previousItems = {}) {
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => {
      const previous = previousItems[key];
      if (
        isReusableWorkItem(previous) &&
        (previous.status === "translated" || previous.status === "skipped")
      ) {
        return [key, previous];
      }
      return [key, classifySourceItem(key, value)];
    }),
  );
}

export function readAITranslationWorkFile(workFilePath) {
  if (!fs.existsSync(workFilePath)) return null;
  const workFile = JSON.parse(fs.readFileSync(workFilePath, "utf8"));
  if (
    !workFile ||
    workFile.version !== 1 ||
    !workFile.items ||
    Array.isArray(workFile.items) ||
    typeof workFile.items !== "object"
  ) {
    throw new Error("检测到的 AI 翻译工作文件格式无效。");
  }
  return workFile;
}

function atomicWriteJson(filePath, data) {
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const backupPath = `${filePath}.${process.pid}.${Date.now()}.bak`;
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    if (fs.existsSync(filePath)) fs.renameSync(filePath, backupPath);
    fs.renameSync(temporaryPath, filePath);
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
  } catch (error) {
    if (!fs.existsSync(filePath) && fs.existsSync(backupPath)) {
      fs.renameSync(backupPath, filePath);
    }
    throw error;
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
  }
}

export function getAITranslationPaths(sourcePath) {
  const parsedPath = path.parse(sourcePath);
  return {
    workFilePath: path.join(
      parsedPath.dir,
      `${parsedPath.name}.ctool-ai-work.json`,
    ),
    outputFilePath: path.join(
      parsedPath.dir,
      `${parsedPath.name}.ai-translated.json`,
    ),
  };
}

export function summarizeWorkItems(items) {
  const summary = {
    translated: 0,
    skipped: 0,
    error: 0,
    untranslated: 0,
  };
  for (const item of Object.values(items)) {
    if (VALID_STATUSES.has(item?.status)) summary[item.status] += 1;
  }
  return summary;
}

export function inspectAITranslationSource(sourcePath) {
  readSourceJson(sourcePath);
  const { workFilePath, outputFilePath } = getAITranslationPaths(sourcePath);
  const workFile = readAITranslationWorkFile(workFilePath);
  const summary = workFile ? summarizeWorkItems(workFile.items) : null;
  return {
    filePath: sourcePath,
    workFilePath,
    outputFilePath: fs.existsSync(outputFilePath) ? outputFilePath : null,
    hasWorkFile: Boolean(workFile),
    hasUnfinishedWork: Boolean(
      summary && (summary.untranslated > 0 || summary.error > 0),
    ),
    summary,
  };
}

export function prepareAITranslationWorkFile(sourcePath) {
  const { source, content } = readSourceJson(sourcePath);
  const { workFilePath, outputFilePath } = getAITranslationPaths(sourcePath);
  const previousWorkFile = readAITranslationWorkFile(workFilePath);
  const items = mergeItems(source, previousWorkFile?.items);
  const workFile = {
    version: 1,
    source: {
      fileName: path.basename(sourcePath),
      fingerprint: crypto.createHash("sha256").update(content).digest("hex"),
    },
    items,
  };

  atomicWriteJson(workFilePath, workFile);
  const summary = summarizeWorkItems(items);
  const isComplete = summary.untranslated === 0 && summary.error === 0;

  if (isComplete) {
    const output = Object.fromEntries(
      Object.entries(items).map(([key, item]) => [key, item.value]),
    );
    atomicWriteJson(outputFilePath, output);
  }

  return {
    filePath: sourcePath,
    workFilePath,
    outputFilePath: isComplete ? outputFilePath : null,
    hasWorkFile: true,
    hasUnfinishedWork: !isComplete,
    isComplete,
    summary,
  };
}

export function saveAITranslationBatch(sourcePath, translatedItems) {
  const { workFilePath } = getAITranslationPaths(sourcePath);
  const workFile = readAITranslationWorkFile(workFilePath);
  if (!workFile) throw new Error("AI 翻译工作文件不存在。");
  for (const [key, item] of Object.entries(translatedItems)) {
    if (!workFile.items[key]) throw new Error(`工作文件中不存在 key“${key}”。`);
    workFile.items[key] = item;
  }
  atomicWriteJson(workFilePath, workFile);
  return summarizeWorkItems(workFile.items);
}

export function markAITranslationBatchError(sourcePath, batch, message) {
  const { workFilePath } = getAITranslationPaths(sourcePath);
  const workFile = readAITranslationWorkFile(workFilePath);
  if (!workFile) throw new Error("AI 翻译工作文件不存在。");
  for (const entry of batch) {
    workFile.items[entry.key] = {
      value: entry.value,
      status: "error",
      error: message,
    };
  }
  atomicWriteJson(workFilePath, workFile);
  return summarizeWorkItems(workFile.items);
}

export function finishAITranslation(sourcePath) {
  const { workFilePath, outputFilePath } = getAITranslationPaths(sourcePath);
  const workFile = readAITranslationWorkFile(workFilePath);
  if (!workFile) throw new Error("AI 翻译工作文件不存在。");
  const summary = summarizeWorkItems(workFile.items);
  const isComplete = summary.untranslated === 0 && summary.error === 0;
  if (isComplete) {
    const output = Object.fromEntries(
      Object.entries(workFile.items).map(([key, item]) => [key, item.value]),
    );
    atomicWriteJson(outputFilePath, output);
  }
  return {
    filePath: sourcePath,
    workFilePath,
    outputFilePath: isComplete ? outputFilePath : null,
    hasWorkFile: true,
    hasUnfinishedWork: !isComplete,
    isComplete,
    summary,
  };
}
