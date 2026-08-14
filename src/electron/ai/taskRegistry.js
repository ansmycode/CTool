import path from "path";

const activeTasks = new Set();

function taskKey(sourcePath) {
  const resolved = path.resolve(sourcePath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

export async function runExclusiveAITranslation(sourcePath, worker) {
  const key = taskKey(sourcePath);
  if (activeTasks.has(key)) {
    throw new Error("这个文件正在翻译中，请勿重复启动任务。");
  }
  activeTasks.add(key);
  try {
    return await worker();
  } finally {
    activeTasks.delete(key);
  }
}
