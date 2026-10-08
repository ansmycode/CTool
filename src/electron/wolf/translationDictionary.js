import fs from 'node:fs/promises';
import path from 'node:path';
import { cleanWolfTextLine } from '../../engine/wolf/text/cleanText.js';

export function prepareWolfDictionary(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('请选择原文到译文的纯净 JSON 字典');
  const entries = Object.entries(data);
  if (entries.length > 100000) throw new Error('译文字典超过 100,000 条');
  const chunks = []; let batch = [], size = 0, total = 0, count = 0;
  for (const [key, value] of entries) {
    if (typeof value !== 'string' || !key || !value || /[\0\r\n]/.test(key + value) || cleanWolfTextLine(key) !== key || cleanWolfTextLine(value) !== value) {
      throw new Error('译文字典必须是单行纯净文本映射，不能包含控制符、空值或 AI 工作文件结构；请重新提取并翻译');
    }
    if (key === value) continue;
    const pair = [];
    for (const field of [key, value]) {
      const bytes = Buffer.from(field, 'utf8');
      if (bytes.toString('utf8') !== field || bytes.length > 8192) throw new Error('译文含无效 Unicode 或单条超过 8,192 字节');
      const length = Buffer.alloc(4); length.writeUInt32LE(bytes.length); pair.push(length, bytes);
    }
    const record = Buffer.concat(pair);
    if (size + record.length > 32000) { chunks.push(Buffer.concat(batch).toString('hex')); batch = []; size = 0; }
    batch.push(record); size += record.length; total += record.length; count++;
    if (total > 32 * 1024 * 1024) throw new Error('译文字典超过 32 MiB');
  }
  if (batch.length) chunks.push(Buffer.concat(batch).toString('hex'));
  if (!count) throw new Error('此文件没有已翻译的条目（原文和译文相同），请选择 AI 输出的译文 JSON');
  return { count, chunks };
}

export async function readWolfDictionary(file, gamePath) {
  if ((await fs.stat(file)).size > 32 * 1024 * 1024) throw new Error('译文 JSON 超过 32 MiB');
  const prepared = prepareWolfDictionary(JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, '')));
  const handle = await fs.open(path.join(path.dirname(gamePath), 'Data/BasicData/Game.dat'), 'r');
  try {
    const header = Buffer.alloc(10); const {bytesRead} = await handle.read(header, 0, 10, 0);
    if (bytesRead !== 10 || !header.subarray(0, 9).equals(Buffer.from([0, 0x57, 0, 0, 0x4f, 0x4c, 0, 0x46, 0x4d])) || ![0, 0x55].includes(header[9])) throw new Error('无法确认普通 Wolf 文本编码，暂不加载译文');
    return {...prepared, encoding: header[9] === 0x55 ? 65001 : 932};
  } finally { await handle.close(); }
}

export function textError(reason) {
  if (/pattern|layout_unsupported|not_linked|invalid_call/.test(reason)) return '当前游戏的文本函数布局尚未支持，未启用翻译 Hook';
  if (reason === 'translation_not_representable_in_game_encoding') return '游戏使用 Shift-JIS，部分译文字符无法表示；本版暂不支持此游戏的中文编码转换';
  if (reason === 'text_hook_fault_restart_game') return '文本 Hook 已停止，请重启游戏；此版本的实际文本布局需要进一步核对';
  return `译文加载失败：${reason}`;
}

export function createTextTransfer(request) {
  let busy = false;
  const send = async payload => {
    const result = await request(payload);
    if (result.status !== 'available') throw new Error(textError(result.reason));
    return result;
  };
  return async (action, dictionary) => {
    if (action === 'status') return send({operation: 'textstatus'});
    if (busy) throw new Error('译文正在加载，请稍后重试');
    busy = true;
    try {
      if (action === 'clear') return await send({operation: 'textclear'});
      if (action !== 'load') throw new Error('无效翻译操作');
      try {
        await send({operation: 'textbegin', count: dictionary.count, encoding: dictionary.encoding});
        for (const hex of dictionary.chunks) await send({operation: 'textchunk', hex});
        const result = await send({operation: 'textcommit'});
        if (!result.hooked || result.faulted || result.loaded !== dictionary.count) throw new Error('译文应用结果未确认');
        return result;
      } catch (error) {
        await send({operation: 'textabort'}).catch(() => {});
        throw error;
      }
    } finally { busy = false; }
  };
}
