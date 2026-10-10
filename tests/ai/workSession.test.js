import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runAITranslation } from '../../src/electron/ai/translator.js';
import { createAIWorkSession } from '../../src/electron/ai/workSession.js';
import { prepareAITranslationWorkFile, getAITranslationPaths, readAITranslationWorkFile } from '../../src/electron/ai/workFile.js';
import { getAITranslationTask, runExclusiveAITranslation } from '../../src/electron/ai/taskRegistry.js';

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ctool-work-session-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const source = path.join(directory, 'source.json');
  fs.writeFileSync(source, JSON.stringify({ A: 'A', B: 'B', C: 'C' }));
  return source;
}
const translated = key => ({ [key]: { status: 'translated', value: `translated-${key}` } });

test('active status is a saved snapshot and batch saves do not reread whole files', async t => {
  const source = fixture(t), { workFilePath } = getAITranslationPaths(source);
  const original = fs.readFileSync;
  let workReads = 0;
  t.mock.method(fs, 'readFileSync', function (file, ...args) {
    if (file === workFilePath) workReads++;
    return original.call(this, file, ...args);
  });
  const snapshots = [];
  const result = await runExclusiveAITranslation(source, (signal, publish) => runAITranslation(source,
    { execution: { concurrency: 3, maxEntries: 1, requestIntervalSeconds: 0 } }, {
      signal, onProgress: file => {
        publish(file);
        const saved = getAITranslationTask(source);
        assert.equal(saved.running, true);
        assert.equal(saved.file.summary.translated, file.summary.translated);
        saved.file.summary.translated = -1;
        assert.equal(getAITranslationTask(source).file.summary.translated, file.summary.translated);
        snapshots.push(file.summary.translated);
      },
      requestBatch: async (_config, batch) => translated(batch[0].key),
    }));
  assert.equal(result.summary.translated, 3);
  assert.equal(workReads, 1);
  assert.deepEqual(snapshots.slice(-4), [1, 2, 3, 3]);
});

test('external work-file edit is preserved and stops queued writes', async t => {
  const source = fixture(t), initial = prepareAITranslationWorkFile(source);
  const session = await createAIWorkSession(source, initial);
  const { workFilePath } = getAITranslationPaths(source);
  const external = `${fs.readFileSync(workFilePath, 'utf8')}  `;
  fs.writeFileSync(workFilePath, external);
  await assert.rejects(session.save(translated('A')), /外部修改/);
  await assert.rejects(session.save(translated('B')), /外部修改/);
  assert.equal(fs.readFileSync(workFilePath, 'utf8'), external);
});

test('failed replacement restores original file and publishes no successful progress', async t => {
  const source = fixture(t), initial = prepareAITranslationWorkFile(source);
  const updates = [], { workFilePath } = getAITranslationPaths(source);
  const before = fs.readFileSync(workFilePath, 'utf8');
  const session = await createAIWorkSession(source, initial, { onProgress: file => updates.push(file.summary.translated) });
  const rename = fsp.rename;
  t.mock.method(fsp, 'rename', async (from, to) => {
    if (from.endsWith('.tmp') && to === workFilePath) throw new Error('simulated replacement failure');
    return rename(from, to);
  });
  await assert.rejects(session.save(translated('A')), /replacement failure/);
  assert.equal(fs.readFileSync(workFilePath, 'utf8'), before);
  assert.deepEqual(updates, [0]);
});

test('cancel after one saved batch prevents another queued batch from changing disk', async t => {
  const source = fixture(t), initial = prepareAITranslationWorkFile(source);
  const controller = new AbortController();
  const session = await createAIWorkSession(source, initial, { signal: controller.signal,
    onProgress: file => { if (file.summary.translated === 1) controller.abort(); } });
  const first = session.save(translated('A'));
  const second = assert.rejects(session.save(translated('B')));
  await first; await second;
  const result = await session.finish();
  assert.equal(result.summary.translated, 1);
  assert.equal(readAITranslationWorkFile(getAITranslationPaths(source).workFilePath).items.B.status, 'untranslated');
});
