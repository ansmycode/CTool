import { DEFAULT_AI_TRANSLATION_SETTINGS } from "../../shared/aiTranslationSettings.js";

export const DEFAULT_BATCH_OPTIONS = Object.freeze({
  maxEntries: DEFAULT_AI_TRANSLATION_SETTINGS.maxEntries,
  maxCharacters: DEFAULT_AI_TRANSLATION_SETTINGS.maxCharacters,
  concurrency: DEFAULT_AI_TRANSLATION_SETTINGS.concurrency,
});

function entryCharacters(entry) {
  return entry.key.length + entry.value.length;
}

export function createTranslationBatches(items, options = {}) {
  const { maxEntries, maxCharacters } = {
    ...DEFAULT_BATCH_OPTIONS,
    ...options,
  };
  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new Error("每批条目数必须是正整数。");
  }
  if (!Number.isInteger(maxCharacters) || maxCharacters < 1) {
    throw new Error("每批字符数必须是正整数。");
  }

  const pendingEntries = Object.entries(items)
    .filter(([, item]) => item.status === "untranslated" || item.status === "error")
    .map(([key, item]) => ({ key, value: item.value, status: item.status }));
  const batches = [];
  let currentBatch = [];
  let currentCharacters = 0;

  for (const entry of pendingEntries) {
    const characters = entryCharacters(entry);
    const exceedsLimit =
      currentBatch.length > 0 &&
      (currentBatch.length >= maxEntries ||
        currentCharacters + characters > maxCharacters);
    if (exceedsLimit) {
      batches.push(currentBatch);
      currentBatch = [];
      currentCharacters = 0;
    }
    currentBatch.push(entry);
    currentCharacters += characters;
  }
  if (currentBatch.length > 0) batches.push(currentBatch);
  return batches;
}

/** 固定并发任务池：任意任务结束后立即补入下一个任务。 */
export async function runTaskPool(tasks, worker, concurrency = 1) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("并发数必须是正整数。");
  }
  const results = new Array(tasks.length);
  let nextIndex = 0;
  let failed = false;
  let firstError;

  async function runNext() {
    while (!failed && nextIndex < tasks.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = await worker(tasks[index], index);
      } catch (error) {
        if (!failed) firstError = error;
        failed = true;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, runNext),
  );
  // Keep the task lock until all in-flight workers have settled.
  if (failed) throw firstError;
  return results;
}
