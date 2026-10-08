import path from "path";

const activeTasks = new Map();

function taskKey(sourcePath) {
  const resolved = path.resolve(sourcePath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

export async function runExclusiveAITranslation(sourcePath, worker) {
  const key = taskKey(sourcePath);
  if (activeTasks.has(key)) {
    throw new Error("这个文件正在翻译中，请勿重复启动任务。");
  }
  const task = { controller: new AbortController(), startedAt: Date.now() };
  activeTasks.set(key, task);
  task.done = Promise.resolve().then(() => worker(task.controller.signal));
  try {
    return await task.done;
  } finally {
    activeTasks.delete(key);
  }
}

export function getAITranslationTask(sourcePath) {
  const task = activeTasks.get(taskKey(sourcePath));
  return { running: Boolean(task), stopping: task?.controller.signal.aborted ?? false,
    startedAt: task?.startedAt ?? null };
}

export async function stopAITranslationTask(sourcePath) {
  const task = activeTasks.get(taskKey(sourcePath));
  if (!task) return;
  task.controller.abort(new Error('翻译已停止，已保存的进度可继续。'));
  // Never unlock while old workers can still write to the same work file.
  await task.done.catch(() => {});
}
