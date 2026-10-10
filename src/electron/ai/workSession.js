import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { getAITranslationPaths, readAITranslationWorkFile, summarizeWorkItems } from './workFile.js';

const signature = stat => `${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}:${stat.ino}`;
async function atomicWrite(filePath, data, beforeReplace = async () => {}) {
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  const backup = `${temporary}.bak`;
  let moved = false;
  try {
    await fs.writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    await beforeReplace();
    try { await fs.rename(filePath, backup); moved = true; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    await fs.rename(temporary, filePath);
  } catch (error) {
    if (moved) await fs.rename(backup, filePath);
    throw error;
  } finally {
    await fs.rm(temporary, { force: true });
  }
  if (moved) await fs.rm(backup, { force: true });
}

// One session owns one source lock. Publish only data that reached disk.
export async function createAIWorkSession(sourcePath, initial, { signal, onProgress = () => {} } = {}) {
  const { workFilePath, outputFilePath } = getAITranslationPaths(sourcePath);
  let work = readAITranslationWorkFile(workFilePath);
  let summary = summarizeWorkItems(work.items);
  const sourceSignature = signature(await fs.stat(sourcePath));
  let workSignature = signature(await fs.stat(workFilePath));
  let queue = Promise.resolve(), failure;
  const unchanged = async () => {
    signal?.throwIfAborted();
    const [sourceStat, workStat] = await Promise.all([fs.stat(sourcePath), fs.stat(workFilePath)]);
    if (signature(sourceStat) !== sourceSignature || signature(workStat) !== workSignature)
      throw new Error('翻译文件被外部修改，请停止后重新选择文件。');
  };
  const file = () => ({ ...initial, summary: { ...summary },
    hasUnfinishedWork: summary.untranslated + summary.error > 0,
    isComplete: summary.untranslated + summary.error === 0 });
  onProgress(file());
  return {
    items: work.items,
    save(changes) {
      const saved = queue.then(async () => {
        if (failure) throw failure;
        signal?.throwIfAborted();
        await unchanged();
        const items = { ...work.items }, nextSummary = { ...summary };
        for (const [key, item] of Object.entries(changes)) {
          if (!Object.hasOwn(items, key)) throw new Error('工作文件条目已变化');
          nextSummary[items[key].status]--;
          nextSummary[item.status]++;
          items[key] = item;
        }
        signal?.throwIfAborted();
        const next = { ...work, items };
        await atomicWrite(workFilePath, next, unchanged);
        workSignature = signature(await fs.stat(workFilePath));
        work = next; summary = nextSummary;
        onProgress(file());
      });
      queue = saved.catch(error => { failure = error; });
      return saved;
    },
    async finish() {
      await queue;
      if (failure && !signal?.aborted) throw failure;
      const result = file();
      if (result.isComplete && !signal?.aborted) {
        await atomicWrite(outputFilePath, Object.fromEntries(Object.entries(work.items).map(([key, item]) => [key, item.value])), unchanged);
        result.outputFilePath = outputFilePath;
      }
      onProgress(result);
      return result;
    },
  };
}
