import fs from 'node:fs/promises';
import path from 'node:path';
import { collectWolfText } from './extractText.js';

const active = new Map();
export const WOLF_TEXT_CACHE = '.ctool-cache/wolf-text';

const auxiliaryDat = {
  'maptree.dat': '地图目录文件，当前未实现此格式的文本提取，不需要 project',
  'maptreeopenstatus.dat': '地图目录展开状态，非本次文本提取对象，不需要 project',
  'tilesetdata.dat': '图块配置文件，当前未实现此格式的文本提取，不需要 project',
  'sysdatabasebasic.dat': '编辑器基本数据库结构，当前未实现此格式的文本提取',
};
function skippedReason(source) {
  return auxiliaryDat[path.basename(source).toLowerCase()];
}

async function listFiles(directory, prefix = '') {
  const result = [];
  for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) result.push(...await listFiles(path.join(directory, entry.name), relative));
    else if (entry.isFile()) result.push(relative);
  }
  return result;
}

export function extractWolfText(gameDirectory, parseFile) {
  const key = path.resolve(gameDirectory).toLowerCase();
  if (active.has(key)) return active.get(key);
  const task = extract(gameDirectory, parseFile).finally(() => active.delete(key));
  active.set(key, task);
  return task;
}

async function exportDictionary(cacheDirectory) {
  const parsed = path.join(cacheDirectory, 'parsed');
  const index = JSON.parse(await fs.readFile(path.join(parsed, 'index.json'), 'utf8'));
  const documents = [];
  for (const entry of index.files) {
    for (const file of entry.outputs) {
      const target = path.resolve(parsed, file);
      if (!target.startsWith(path.resolve(parsed) + path.sep)) throw new Error('解析缓存包含无效路径');
      documents.push({ source: entry.source, kind: entry.kind, data: JSON.parse(await fs.readFile(target, 'utf8')) });
    }
  }
  const { dictionary, locations } = collectWolfText(documents);
  await fs.writeFile(path.join(parsed, 'text-locations.json'), JSON.stringify(locations, null, 2), 'utf8');
  const jsonPath = path.join(cacheDirectory, 'CatToolTranslate.json');
  await fs.writeFile(jsonPath, JSON.stringify(dictionary, null, 2), 'utf8');
  return { cacheDirectory, jsonPath, textCount: Object.keys(dictionary).length, parsedFiles: index.files.length,
    skipped: index.skipped.map(item => ({ ...item, reason: skippedReason(item.source) ?? item.reason })) };
}

async function extract(gameDirectory, parseFile) {
  const cacheDirectory = path.join(gameDirectory, WOLF_TEXT_CACHE);
  try {
    await fs.access(cacheDirectory);
    try { return { ...await exportDictionary(cacheDirectory), reusedCache: true }; }
    catch (error) { throw new Error(`读取解析缓存失败，请删除 ${cacheDirectory} 后重新提取：${error.message}`); }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const dataDirectory = path.join(gameDirectory, 'Data');
  const sources = await listFiles(dataDirectory);
  const names = new Map(sources.map(file => [file.toLowerCase(), file]));
  const jobs = [], skipped = [];
  for (const source of sources) {
    const extension = path.extname(source).toLowerCase();
    if (!['.mps', '.dat'].includes(extension)) continue;
    const basename = path.basename(source).toLowerCase();
    let kind, project;
    if (extension === '.mps') kind = 'map';
    else if (basename === 'commonevent.dat') kind = 'common';
    else if (basename === 'game.dat') kind = 'game';
    else {
      project = names.get(source.slice(0, -4).toLowerCase() + '.project');
      if (project && basename !== 'sysdatabasebasic.dat') kind = 'database';
    }
    if (kind) jobs.push({ source, kind, project });
    else skipped.push({ source, reason: skippedReason(source) ?? `未识别此 DAT 的布局；若为数据库，缺少同目录结构文件 ${path.basename(source, path.extname(source))}.project` });
  }
  if (!jobs.length) throw new Error('Data 目录中没有可解析的 MPS / DAT 文件；当前不支持资源包解包。');
  const parent = path.dirname(cacheDirectory);
  await fs.mkdir(parent, { recursive: true });
  const temporary = await fs.mkdtemp(path.join(parent, 'wolf-text-building-'));
  try {
    const parsed = path.join(temporary, 'parsed');
    await fs.mkdir(parsed);
    const index = { files: [], skipped };
    for (const job of jobs) {
      const output = path.join(parsed, job.source);
      await fs.mkdir(output, { recursive: true });
      try {
        await parseFile({ kind: job.kind, input: path.join(dataDirectory, job.source), output,
          project: job.project ? path.join(dataDirectory, job.project) : undefined });
      } catch (error) { throw new Error(`解析 ${job.source} 失败：${error.message}`); }
      const outputs = (await listFiles(output)).filter(file => file.endsWith('.json')).map(file => path.join(job.source, file));
      index.files.push({ ...job, outputs });
    }
    await fs.writeFile(path.join(parsed, 'index.json'), JSON.stringify(index, null, 2), 'utf8');
    const result = await exportDictionary(temporary);
    await fs.rename(temporary, cacheDirectory);
    return { ...result, cacheDirectory, jsonPath: path.join(cacheDirectory, 'CatToolTranslate.json'), reusedCache: false };
  } finally {
    // Only the exact mkdtemp directory owned by this operation is removed.
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
