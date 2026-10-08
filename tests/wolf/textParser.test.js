import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { collectWolfText } from '../../src/engine/wolf/text/extractText.js';

import { parseWolfFileInWorker as parse } from '../../src/electron/services/wolfTextService.js';
import { decodeLz4Block } from '../../src/engine/wolf/text/binaryReader.js';
import { parseDatabase, parseCommonEvents } from '../../src/engine/wolf/text/fileParser.js';
const u32 = value => { const bytes = Buffer.alloc(4); bytes.writeUInt32LE(value); return bytes; };
const b = (...values) => Buffer.from(values);
const str = value => { const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8'); return Buffer.concat([u32(bytes.length + 1), bytes, b(0)]); };
const command = (code, values) => Buffer.concat([b(1), u32(code), b(0, values.length), ...values.map(str), b(0)]);

test('LZ4 handles overlapping matches and rejects invalid offsets and sizes', () => {
  assert.equal(decodeLz4Block(b(0x10, 0x61, 1, 0), 5).toString(), 'aaaaa');
  assert.equal(decodeLz4Block(b(0x30, 97, 98, 99), 3).toString(), 'abc');
  assert.throws(() => decodeLz4Block(b(0x10, 97, 0, 0), 5));
  assert.throws(() => decodeLz4Block(b(0x30, 97), 3));
  assert.throws(() => decodeLz4Block(b(0x10, 97), 2));
});

test('database joins project field labels to DAT strings and numeric values', () => {
  const project = Buffer.concat([u32(1), str('Items'), u32(2), str('名前'), str('価格'),
    u32(1), str('record'), str('description'), u32(2), b(0, 0), u32(0), u32(0), u32(0), u32(0)]);
  const dat = Buffer.concat([b(0, 0x57, 0, 0, 0x4f, 0x4c, 0x55, 0x46, 0x4d, 0, 0xc1),
    u32(1), b(0xfe, 0xff, 0xff, 0xff), u32(0), u32(2), u32(2000), u32(1000),
    u32(1), u32(42), str('薬草'), b(0xc1)]);
  const data = parseDatabase(dat, project);
  assert.deepEqual(data.types[0].data[0].data, [{name: '名前', value: '薬草'}, {name: '価格', value: 42}]);
  assert.equal(collectWolfText([{kind: 'database', source: 'DataBase.dat', data}]).dictionary['薬草'], '薬草');
  assert.throws(() => parseDatabase(dat, u32(0)), /表数量/);
});

test('common events preserve dialogue commands through compressed layouts', () => {
  const header = b(0, 0x57, 0, 0, 0x4f, 0x4c, 0x55, 0x46, 0x43, 0, 0x93);
  const payload = Buffer.concat([u32(1), b(0x8e), u32(8), Buffer.alloc(11), str('event'),
    u32(1), command(101, ['こんにちは']), b(0), str(''), str('description'), b(0x8f),
    u32(0), u32(0), u32(0), u32(0), Buffer.alloc(29), ...Array.from({length: 100}, () => str('')),
    b(0x91), str(''), b(0x91, 0x89)]);
  // Encode one raw LZ4 literal sequence, including extended length bytes.
  let remaining = payload.length - 15; const lengths = [];
  while (remaining >= 255) { lengths.push(255); remaining -= 255; }
  lengths.push(remaining);
  const compressed = Buffer.concat([b(0xf0, ...lengths), payload]);
  const events = parseCommonEvents(Buffer.concat([header, u32(payload.length), u32(compressed.length), compressed]));
  assert.equal(events[0].id, 8);
  assert.equal(events[0].commands[0].stringArgs[0], 'こんにちは');
});

function mapFixture(utf8 = true) {
  const magic = Buffer.alloc(20);
  magic.write('WOLFM', 10, 'ascii');
  if (utf8) magic[16] = 0x55;
  const message = utf8 ? 'こんにちは\\c[2]\n世界' : b(0x82, 0xa0); // Shift-JIS あ
  const cmds = [command(101, [message]), command(102, ['Yes', 'No']), command(103, ['editor comment'])];
  const page = Buffer.concat([u32(0), str(''), Buffer.alloc(4 + 37 + 4 + 2), u32(0), u32(cmds.length), ...cmds, u32(0), b(0, 1, 1, 0x7a)]);
  const event = Buffer.concat([b(0x6f, 0x39, 0x30, 0, 0), u32(7), str('event'), u32(0), u32(0), u32(1), u32(0), b(0x79), page, b(0x70)]);
  return Buffer.concat([magic, u32(100), b(0), str(''), u32(0), u32(1), u32(1), u32(1), Buffer.alloc(12), event, b(0x66)]);
}

test('JS worker reads UTF-8/Shift-JIS MPS and DAT fixtures without modifying sources', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ctool-parser-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const utf8 of [true, false]) {
    const source = path.join(root, `地图 ${utf8}.mps`), output = path.join(root, `out-${utf8}`);
    const bytes = mapFixture(utf8);
    await fs.writeFile(source, bytes);
    await parse({kind: 'map', input: source, output});
    assert.deepEqual(await fs.readFile(source), bytes);
    const data = JSON.parse(await fs.readFile(path.join(output, `地图 ${utf8}.json`), 'utf8'));
    assert.equal(data.events[0].id, 7);
    const text = utf8 ? 'こんにちは\\c[2]\n世界' : 'あ';
    assert.equal(data.events[0].pages[0].list[0].stringArgs[0], text);
    const { dictionary } = collectWolfText([{ source, kind: 'map', data }]);
    for (const line of (utf8 ? ['こんにちは', '世界'] : ['あ'])) assert.equal(dictionary[line], line);
    assert.equal(dictionary['editor comment'], undefined);
  }
  const dat = path.join(root, 'DataBase.dat'), project = path.join(root, 'DataBase.project');
  await fs.writeFile(project, u32(0));
  await fs.writeFile(dat, Buffer.concat([b(0, 0x57, 0, 0, 0x4f, 0x4c, 0x55, 0x46, 0x4d, 0, 0xc1), u32(0), b(0xc1)]));
  await parse({kind: 'database', input: dat, output: path.join(root, 'db'), project});
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, 'db/DataBase.json'), 'utf8')), { types: [] });
  const common = path.join(root, 'CommonEvent.dat');
  await fs.writeFile(common, Buffer.concat([b(0, 0x57, 0, 0, 0x4f, 0x4c, 0x55, 0x46, 0x43, 0, 0x8f), u32(0), b(0x89)]));
  await parse({kind: 'common', input: common, output: path.join(root, 'common')});
  const malformed = path.join(root, 'broken.mps');
  await fs.writeFile(malformed, mapFixture().subarray(0, 40));
  await assert.rejects(parse({kind: 'map', input: malformed, output: path.join(root, 'bad')}));
  const pro = path.join(root, 'Pro.mps');
  const proBytes = mapFixture(); proBytes[1] = 0x50;
  await fs.writeFile(pro, proBytes);
  await assert.rejects(parse({kind: 'map', input: pro, output: path.join(root, 'pro')}), /Wolf Pro/);
});
