import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { requestTranslationBatch } from '../../src/electron/ai/providerClient.js';
import { runAITranslation } from '../../src/electron/ai/translator.js';
import { getAITranslationTask, runExclusiveAITranslation, stopAITranslationTask } from '../../src/electron/ai/taskRegistry.js';
import { AIProviderError } from '../../src/electron/ai/providerClient.js';
import { getAITranslationPaths, readAITranslationWorkFile } from '../../src/electron/ai/workFile.js';

const config = { provider: 'deepseek', baseUrl: 'https://example.com', apiKey: 'test-secret', model: 'test', sourceLanguage: '日语', targetLanguage: '中文' };
const batch = [{ key: '猫', value: '猫', status: 'untranslated' }];
const tick = () => new Promise(resolve => setImmediate(resolve));
const translated = items => Object.fromEntries(items.map(item => [item.key, { value: `译-${item.key}`, status: 'translated' }]));

test('request deadline covers hung fetch and hung response body, even if abort is ignored', async () => {
  for (const fetchImpl of [
    () => new Promise(() => {}),
    async () => ({ ok: true, text: () => new Promise(() => {}) }),
  ]) {
    await assert.rejects(requestTranslationBatch(config, batch, { timeoutMs: 20, fetchImpl }),
      error => error.message === 'AI 服务响应超时。' && error.retryable);
  }
});

test('user cancellation interrupts response body without waiting for request timeout', async () => {
  const controller = new AbortController();
  const task = requestTranslationBatch(config, batch, { signal: controller.signal,
    fetchImpl: async () => ({ ok: true, text: () => new Promise(() => {}) }) });
  const checked = assert.rejects(task, /用户停止/);
  await tick();
  controller.abort(new Error('用户停止'));
  await checked;
});

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ctool-ai-stop-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const source = path.join(directory, 'source.json');
  fs.writeFileSync(source, JSON.stringify({ A: 'A', B: 'B', C: 'C', D: 'D' }));
  return source;
}

test('stop preserves saved batches, releases lock, resumes pending text and ignores late old results', async t => {
  const source = fixture(t);
  const pending = [];
  const task = runExclusiveAITranslation(source, signal => runAITranslation(source,
    { execution: { concurrency: 2, maxEntries: 1, requestIntervalSeconds: 0 } }, {
      signal,
      requestBatch: (_config, items) => new Promise(resolve => pending.push(() => resolve(translated(items)))),
    }));
  await tick();
  assert.equal(getAITranslationTask(source).running, true);
  pending[0]();
  await tick();
  assert.equal(pending.length, 3);
  await stopAITranslationTask(source);
  assert.equal(getAITranslationTask(source).running, false);
  const first = await task;
  assert.equal(first.summary.translated, 1);
  assert.equal(first.summary.untranslated, 3);
  let requested = 0;
  const resumed = await runExclusiveAITranslation(source, signal => runAITranslation(source,
    { execution: { requestIntervalSeconds: 0 } }, { signal, requestBatch: async (_config, items) => {
      requested += items.length; return translated(items);
    } }));
  assert.equal(requested, 3);
  assert.equal(resumed.isComplete, true);
  const { workFilePath } = getAITranslationPaths(source);
  const saved = readAITranslationWorkFile(workFilePath);
  pending.slice(1).forEach(resolve => resolve());
  await tick();
  assert.deepEqual(readAITranslationWorkFile(workFilePath), saved);
});

test('stop interrupts long Retry-After wait and does not mark canceled batches as errors', async t => {
  const source = fixture(t);
  let calls = 0;
  const task = runExclusiveAITranslation(source, signal => runAITranslation(source, {}, {
    signal, requestBatch: async () => {
      calls++;
      throw new AIProviderError('限流', { retryable: true, retryAfterMs: 3600000 });
    },
  }));
  await tick();
  await stopAITranslationTask(source);
  const result = await task;
  assert.equal(calls, 1);
  assert.equal(result.summary.error, 0);
  assert.equal(result.summary.untranslated, 4);
  assert.equal(getAITranslationTask(source).running, false);
});
