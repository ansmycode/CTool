import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { extractWolfText } from '../../src/engine/wolf/text/cache.js';
import { collectWolfText } from '../../src/engine/wolf/text/extractText.js';
import { extractWolfSessionText } from '../../src/electron/services/wolfTextService.js';

const map = text => ({ events: [{ id: 9, pages: [{ id: 0, list: [
  { index: 2, code: 101, stringArgs: [text] },
  { index: 3, code: 102, stringArgs: ['はい', 'いいえ'] },
  { index: 4, code: 103, stringArgs: ['开发注释'] },
  { index: 5, code: 106, stringArgs: ['调试信息'] },
  { index: 6, code: 122, stringArgs: ['Picture/a.png'] },
] }] }] });

test('semantic selection splits lines and excludes comments, debug and resource strings', () => {
  const text = '  こんにちは\\c[2]\n世界';
  const { dictionary, locations } = collectWolfText([
    { kind: 'map', source: 'MapData/一.mps', data: map(text) },
    { kind: 'common', source: 'CommonEvent.dat', data: { id: 2, commands: [{ index: 1, code: 101, stringArgs: [text, '__proto__'] }] } },
    { kind: 'database', source: 'DataBase.dat', data: { types: [{ name: '道具', data: [{ name: 'Editor label', data: [
      { name: '名前', value: '薬草' }, { name: '説明文', value: 'HPを回復' },
      { name: '画像ファイル名', value: 'icon.png' }, { name: 'コモン名前', value: '内部标签' },
    ] }] }] } },
  ]);
  assert.equal(dictionary[text], undefined);
  assert.equal(dictionary['こんにちは'], 'こんにちは');
  assert.equal(dictionary['こんにちは\\c[2]'], undefined);
  assert.equal(dictionary['世界'], '世界');
  assert.equal(dictionary['薬草'], '薬草');
  assert.equal(dictionary['HPを回復'], 'HPを回復');
  assert.equal(dictionary['__proto__'], '__proto__');
  assert.equal(Object.keys(dictionary).length, 7);
  assert.equal(locations['世界'].length, 2);
  const position = locations['世界'][0];
  assert.deepEqual(position, { source: 'MapData/一.mps', event: 9, page: 0, command: 2, code: 101, argument: 0,
    line: 1, start: text.indexOf('世界'), end: text.length });
  assert.equal(text.slice(position.start, position.end), '世界');
});

test('pure JSON strips MV/MZ-style controls and deduplicates display text with source locations', () => {
  const clean = '[覚醒：持続中、攻撃回数が2倍になる]';
  const original = `\\c[2]${clean}\\c[0]`;
  const values = [original, `\\c[3]${clean}\\c[0]`,
    '\\foo<1>本文\\bar{2}\\baz(3)\\.\\!\\>\\<\\{\\}\\^',
    '<tag>回避率[Evd]</tag>\\|\\~\\$', '\\c[2]\\c[0]', '\\c[2]123\\c[0]', '\\c[2]null\\c[0]'];
  const { dictionary, locations } = collectWolfText([{ kind: 'common', source: 'CommonEvent.dat',
    data: { id: 1, commands: [{ code: 101, index: 0, stringArgs: values }] } }]);
  assert.deepEqual({ ...dictionary }, { [clean]: clean, 本文: '本文', '回避率[Evd]': '回避率[Evd]' });
  assert.equal(locations[clean].length, 2);
  assert.equal(original.slice(locations[clean][0].start, locations[clean][0].end), original);
});

test('string assignments feeding custom dialogue export alongside ordinary messages', () => {
  const messages = ['？？？「あなたは、生きている人ですか……？」', 'この力は、完全じゃなかったのか。', '西の村へ向かえ'];
  const list = messages.map((text, index) => ({ code: 122, index, stringArgs: [text] }));
  list.push({ code: 122, index: 3, stringArgs: ['Picture/背景.png', 'icon.png', 'https://example.test/image', '\\c[2]聖女\\c[0]'] });
  const { dictionary, locations } = collectWolfText([
    { kind: 'map', source: 'map.mps', data: { events: [{ id: 0, pages: [{ id: 0, list }] }] } },
    { kind: 'common', source: 'CommonEvent.dat', data: { id: 1, commands: list } },
  ]);
  assert.deepEqual(Object.keys(dictionary), [...messages, '聖女']);
  for (const text of messages) {
    assert.equal(dictionary[text], text);
    assert.equal(locations[text].length, 2);
    assert.equal(locations[text][0].code, 122);
  }
});

test('line export handles CRLF, LF, CR, empty lines, whitespace and duplicates', () => {
  const first = '勇者ロディが振るった愛剣、バールのようなもの。';
  const second = '血に飢えた魔剣、殺傷力が高い。';
  const text = `  ${first}  \r\n\n${second}\r${first}\n  \n123\n`;
  const { dictionary, locations } = collectWolfText([{ kind: 'game', source: 'Game.dat', data: { Title: text } }]);
  assert.deepEqual({ ...dictionary }, { [first]: first, [second]: second });
  assert.deepEqual(locations[first].map(item => item.line), [0, 3]);
  for (const [key, entries] of Object.entries(locations)) for (const entry of entries) {
    assert.equal(text.slice(entry.start, entry.end), key);
  }
});

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ctool-wolf-text-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'Data/MapData'), { recursive: true });
  await fs.writeFile(path.join(root, 'Data/MapData/一.mps'), 'source');
  return root;
}

test('GUI terms, actor display names, common-event arguments and text pictures are collected', () => {
  const { dictionary } = collectWolfText([
    { kind: 'database', source: 'db.dat', data: { types: [
      { name: '用語設定', data: [{ name: 'editor label', data: [{ name: '[ﾒﾆｭｰ]アイテム', value: 'アイテム' }, { name: '画像ファイル', value: 'menu.png' }] }] },
      { name: '主人公ステータス', data: [{ data: [{ name: 'キャラ名', value: 'あなた' }, { name: '肩書き', value: '勇者' }] }] },
    ] } },
    { kind: 'common', source: 'CommonEvent.dat', data: { commands: [
      { code: 210, stringArgs: ['NPC情報', '魔王じみた妹ルディ', 'Picture/icon.png'] },
      { code: 150, intArgs: [0x20], stringArgs: ['\\c[2]保存しますか？\\c[0]'] },
      { code: 150, intArgs: [0], stringArgs: ['Picture/背景.png'] },
      { code: 250, stringArgs: ['データベース名', '内部参照'] },
    ] } },
  ]);
  assert.deepEqual(Object.keys(dictionary), ['アイテム', 'あなた', '勇者', '魔王じみた妹ルディ', '保存しますか？']);
});

test('first extraction stores readable files; repeat reads only cache; deleting cache reparses', async t => {
  const root = await fixture(t);
  let calls = 0;
  const parse = async ({ output }) => {
    calls++;
    await fs.writeFile(path.join(output, '一.json'), JSON.stringify(map('最初')));
  };
  const first = await extractWolfText(root, parse);
  assert.equal(first.reusedCache, false);
  assert.equal(calls, 1);
  const cached = path.join(first.cacheDirectory, 'parsed/MapData/一.mps/一.json');
  await fs.writeFile(cached, JSON.stringify(map('\\c[2]缓存编辑\\c[0]\n第二行')));
  await fs.writeFile(first.jsonPath, '{}');
  // The original files need not even exist on subsequent extraction.
  await fs.rename(path.join(root, 'Data'), path.join(root, 'Data.saved'));
  const second = await extractWolfText(root, () => { throw new Error('must not parse'); });
  assert.equal(second.reusedCache, true);
  assert.equal(JSON.parse(await fs.readFile(second.jsonPath, 'utf8'))['缓存编辑'], '缓存编辑');
  assert.equal(JSON.parse(await fs.readFile(second.jsonPath, 'utf8'))['第二行'], '第二行');
  await fs.rm(first.cacheDirectory, { recursive: true });
  await fs.rename(path.join(root, 'Data.saved'), path.join(root, 'Data'));
  await extractWolfText(root, parse);
  assert.equal(calls, 2);
});

test('failed parse leaves no formal cache and a later attempt can succeed', async t => {
  const root = await fixture(t);
  await assert.rejects(extractWolfText(root, async () => { throw new Error('bad input'); }), /一.mps.*bad input/);
  assert.deepEqual(await fs.readdir(path.join(root, '.ctool-cache')), []);
  const result = await extractWolfText(root, async ({ output }) => {
    await fs.writeFile(path.join(output, 'map.json'), JSON.stringify(map('成功')));
  });
  assert.equal(result.textCount, 3);
});

test('DAT classification requires schema; unknown DAT reported and concurrent clicks share one parse', async t => {
  const root = await fixture(t);
  await fs.writeFile(path.join(root, 'Data/Missing.dat'), 'unknown');
  await fs.writeFile(path.join(root, 'Data/Custom.dat'), 'db');
  await fs.writeFile(path.join(root, 'Data/Custom.project'), 'schema');
  const jobs = [];
  const parse = async job => {
    jobs.push(job);
    await fs.writeFile(path.join(job.output, 'data.json'), JSON.stringify(job.kind === 'map' ? map('文本') : { types: [] }));
  };
  const [a, b] = await Promise.all([extractWolfText(root, parse), extractWolfText(root, parse)]);
  assert.equal(jobs.length, 2);
  assert.equal(a, b);
  assert.ok(jobs.find(j => j.kind === 'database').project.endsWith('Custom.project'));
  assert.equal(a.skipped[0].source, 'Missing.dat');
});

test('corrupt existing cache reports error instead of rebuilding from originals', async t => {
  const root = await fixture(t);
  await fs.mkdir(path.join(root, '.ctool-cache/wolf-text'), { recursive: true });
  await assert.rejects(extractWolfText(root, () => { throw new Error('should not run'); }), /删除.*wolf-text/);
});

test('auxiliary DAT files report unsupported purpose instead of missing project', async t => {
  const root = await fixture(t);
  for (const name of ['MapTree', 'MapTreeOpenStatus', 'TileSetData']) {
    await fs.writeFile(path.join(root, `Data/${name}.dat`), 'auxiliary');
  }
  const result = await extractWolfText(root, async ({output}) => {
    await fs.writeFile(path.join(output, 'map.json'), JSON.stringify(map('文本')));
  });
  assert.equal(result.skipped.length, 3);
  for (const item of result.skipped) assert.match(item.reason, /不需要 project/);
  const indexPath = path.join(result.cacheDirectory, 'parsed/index.json');
  const index = JSON.parse(await fs.readFile(indexPath, 'utf8'));
  for (const item of index.skipped) item.reason = 'old ambiguous message';
  await fs.writeFile(indexPath, JSON.stringify(index));
  const cached = await extractWolfText(root, () => { throw new Error('must reuse cache'); });
  for (const item of cached.skipped) assert.match(item.reason, /不需要 project/);
});

test('Wolf extraction rejects stale or wrong-engine sessions before file access', async () => {
  await assert.rejects(extractWolfSessionText({ sessionId: 'new', game: { engine: 'wolf' } }, 'old', ''), /会话/);
  await assert.rejects(extractWolfSessionText({ sessionId: 'same', game: { engine: 'MV' }, processState: 'running' }, 'same', ''), /会话/);
});
