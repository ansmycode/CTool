// Read-only JS port of the WolfTL format readers; see README.md.
import fs from 'node:fs/promises';
import path from 'node:path';
import { BinaryReader } from './binaryReader.js';

const datMagic = [0x57, 0, 0, 0x4f, 0x4c, 0, 0x46, 0x4d, 0];
function reader(buffer, kind) {
  const r = new BinaryReader(buffer);
  if (buffer[1] === 0x50) r.fail('暂不支持 Wolf Pro 数据');
  if (kind === 'map') {
    if (buffer.length > 24 && buffer.readUInt32LE(20) >= 0x65) { r.skip(25); r.unpack(); r.offset = 0; }
    r.magic([...Array(10).fill(0), 0x57, 0x4f, 0x4c, 0x46, 0x4d, 0, 0, 0, 0, 0], 16);
  } else {
    if (r.u8() !== 0) r.fail('暂不支持加密 DAT');
    if (kind === 'database' && buffer[10] === 0xc4) { r.offset = 11; r.unpack(); r.offset = 1; }
    const magic = [...datMagic]; if (kind === 'common') magic[7] = 0x43;
    r.magic(magic, kind === 'game' ? 8 : 5);
  }
  return r;
}

function route(r) { r.u8(); r.skip(r.u8() * 4); r.expect(1, 0); }
function commands(r, v35) {
  return r.array(index => {
    const args = r.u8(); if (!args) r.fail('指令参数数量无效');
    const code = r.u32(), intArgs = Array.from({ length: args - 1 }, () => r.u32());
    r.u8(); const stringArgs = Array.from({ length: r.u8() }, () => r.string());
    const end = r.u8(); if (end !== 0 && end !== 1) r.fail('指令结束标记错误');
    if (end === 1 || code === 201) { r.skip(6); r.array(() => route(r)); }
    if (v35) r.skip(r.u8());
    return { index, code, intArgs, stringArgs };
  });
}

export function parseMap(buffer) {
  const r = reader(buffer, 'map'), version = r.u32(); r.u8(); r.string();
  r.u32(); const width = r.u32(), height = r.u32(), count = r.u32();
  let layers = 3;
  if (version >= 0x67) { r.u32(); layers = r.u32(); }
  if (r.offset < r.buffer.length - 1) {
    if (r.encoding === 'utf-8' && r.buffer.readInt32LE(r.offset) === -1) r.skip(4);
    else r.skip(width * height * layers * 4);
  }
  const events = [];
  for (let n = 0; n < count; n++) {
    r.expect(0x6f, 0x39, 0x30, 0, 0);
    const id = r.u32(), name = r.string(); r.skip(8); const pageCount = r.count(); r.expect(0, 0, 0, 0);
    const pages = [];
    for (let page = 0; page < pageCount; page++) {
      r.expect(0x79); r.u32(); r.string(); r.skip(4 + 37 + 4 + 2);
      r.array(() => route(r)); const list = commands(r, version >= 0x67);
      const features = r.u32(); r.skip(3); if (features > 3) r.u8(); r.expect(0x7a);
      pages.push({ id: page, list });
    }
    r.expect(0x70); events.push({ id, name, pages });
  }
  r.expect(0x66); r.end(); return { events };
}

export function parseCommonEvents(buffer) {
  const r = reader(buffer, 'common'), version = r.u8(), v35 = version === 0x93 || version === 0xcc;
  if (v35) r.unpack();
  const events = r.array(() => {
    r.expect(0x8e); const id = r.u32(); r.skip(11); const name = r.string(), list = commands(r, v35);
    r.string(); const description = r.string(); r.expect(0x8f);
    r.array(() => r.string()); r.skip(r.count());
    r.array(() => r.array(() => r.string())); r.array(() => r.skip(r.count() * 4));
    r.skip(29); for (let i = 0; i < 100; i++) r.string();
    r.expect(0x91); r.string(); const marker = r.u8();
    if (marker === 0x92) { r.string(); r.u32(); r.expect(0x92); }
    else if (marker !== 0x91) r.fail('公共事件结束标记错误');
    return { id, name, description, commands: list };
  });
  if (r.u8() < 0x89) r.fail('公共事件文件结束标记错误'); r.end(); return events;
}

export function parseDatabase(buffer, project) {
  const r = reader(buffer, 'database'), version = r.u8(), p = new BinaryReader(project, r.encoding);
  const types = p.array(() => {
    const name = p.string(), fields = p.array(() => ({ name: p.string() }));
    const data = p.array(() => ({ name: p.string(), data: [] })), description = p.string();
    const fieldTypes = p.count(); if (fieldTypes < fields.length) p.fail('project 字段类型数量不足'); p.skip(fieldTypes);
    p.array(() => p.string());
    p.array(i => { const args = p.array(() => p.string()); if (fields[i] && args.length) fields[i].stringArgs = args; });
    p.array(() => p.skip(p.count() * 4)); p.skip(p.count() * 4);
    return { name, description, fields, data };
  });
  p.end(); if (r.u32() !== types.length) r.fail('DAT 和 project 的表数量不一致');
  for (const type of types) {
    r.expect(0xfe, 0xff, 0xff, 0xff); const marker = r.u32(), fieldCount = r.count();
    if (fieldCount > type.fields.length) r.fail('DAT 字段数量超过 project');
    if (marker === 0x1d4c0) r.string();
    const indices = Array.from({ length: fieldCount }, () => r.u32());
    const recordCount = r.count();
    if (recordCount > type.data.length) r.fail('DAT 记录数量超过 project');
    type.data.length = recordCount;
    const strings = indices.filter(i => i >= 2000).length, integers = fieldCount - strings;
    for (const row of type.data) {
      const numbers = Array.from({ length: integers }, () => r.u32());
      const texts = Array.from({ length: strings }, () => r.string());
      row.data = type.fields.map((field, i) => {
        const index = indices[i] ?? 0;
        const value = index >= 2000 ? texts[index - 2000] : index >= 1000 ? numbers[index - 1000] : 'INVALID_IGNORE';
        if (value === undefined) r.fail('数据库字段索引超出值列表');
        return { name: field.name, value };
      });
    }
  }
  r.expect(version); r.end(); return { types };
}

export function parseGameDat(buffer) {
  const r = reader(buffer, 'game'); r.skip(r.count()); const count = r.u32();
  if (![8, 9, 13, 14].includes(count)) r.fail(`暂不支持 Game.dat 字符串布局 ${count}`);
  const Title = r.string(); if (r.string() !== '0000-0000') r.fail('Game.dat 标记错误');
  r.skip(r.count()); const MainFont = r.string(), SubFonts = Array.from({ length: 3 }, () => r.string()); r.string();
  const data = { Title, TitlePlus: count >= 9 ? r.string() : '', MainFont, SubFonts };
  if (count > 9) { r.string(); r.string(); data.StartUpMsg = r.string(); data.TitleMsg = r.string(); }
  if (count > 13) r.string();
  r.u32(); r.u32(); r.skip(r.count() * 2); r.skip(8); r.skip(r.buffer.length - r.offset);
  return data;
}

export async function parseWolfFile({ kind, input, project, output }) {
  const buffer = await fs.readFile(input);
  let documents;
  if (kind === 'common') documents = parseCommonEvents(buffer).map((data, i) => [`${i}.json`, data]);
  else {
    const data = kind === 'map' ? parseMap(buffer) : kind === 'game' ? parseGameDat(buffer)
      : kind === 'database' ? parseDatabase(buffer, await fs.readFile(project)) : null;
    if (!data) throw new Error(`不支持的解析类型：${kind}`);
    documents = [[`${path.parse(input).name}.json`, data]];
  }
  await fs.mkdir(output, { recursive: true });
  for (const [name, data] of documents) await fs.writeFile(path.join(output, name), JSON.stringify(data, null, 2), 'utf8');
}
