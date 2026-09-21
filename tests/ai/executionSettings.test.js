import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { normalizeAITranslationSettings } from "../../src/shared/aiTranslationSettings.js";
import { createRequestThrottle, runAITranslation } from "../../src/electron/ai/translator.js";
import { AIProviderError } from "../../src/electron/ai/providerClient.js";
import { runExclusiveAITranslation } from "../../src/electron/ai/taskRegistry.js";

const tick = () => new Promise(resolve => setImmediate(resolve));
const translated = batch => Object.fromEntries(batch.map(item => [item.key, { value: `译-${item.value}`, status: "translated" }]));
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ctool-settings-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const source = path.join(directory, "source.json");
  fs.writeFileSync(source, JSON.stringify({ A: "A", B: "B", C: "C", D: "D" }));
  return source;
}

test("高级配置拒绝无效范围、类型和小数，缺省值兼容旧调用", () => {
  assert.equal(normalizeAITranslationSettings().concurrency, 1);
  for (const invalid of [{ concurrency: 0 }, { concurrency: 1.5 }, { maxEntries: "3" }, { maxCharacters: NaN }, { requestIntervalSeconds: 0.12 }, { requestTimeoutSeconds: 601 }, { maxRetries: -1 }, null]) {
    assert.throws(() => normalizeAITranslationSettings(invalid));
  }
  assert.equal(normalizeAITranslationSettings({ requestIntervalSeconds: 0.3 }).requestIntervalSeconds, 0.3);
});

test("非法配置在创建工作文件前被拒绝", async t => {
  const source = fixture(t);
  await assert.rejects(runAITranslation(source, { execution: { concurrency: 99 } }));
  assert.deepEqual(fs.readdirSync(path.dirname(source)), ["source.json"]);
});

test("并发配置真正生效，乱序完成仍保存所有批次并传递超时", async t => {
  const source = fixture(t);
  const pending = [];
  const task = runAITranslation(source, { execution: { concurrency: 2, maxEntries: 1, requestIntervalSeconds: 0, requestTimeoutSeconds: 17 } }, {
    requestBatch: (_config, batch, options) => {
      assert.equal(options.timeoutMs, 17000);
      return new Promise(resolve => pending.push(() => resolve(translated(batch))));
    },
  });
  await tick();
  assert.equal(pending.length, 2);
  pending[1]();
  await tick();
  assert.equal(pending.length, 3);
  pending[2]();
  await tick();
  assert.equal(pending.length, 4);
  pending[3]();
  pending[0]();
  const result = await task;
  assert.equal(result.summary.translated, 4);
  assert.equal(result.isComplete, true);
});

test("字符上限独立于条目上限生效", async t => {
  const sizes = [];
  await runAITranslation(fixture(t), { execution: { maxEntries: 100, maxCharacters: 4, requestIntervalSeconds: 0 } }, {
    requestBatch: async (_config, batch) => { sizes.push(batch.length); return translated(batch); },
  });
  assert.deepEqual(sizes, [2, 2]);
});

test("重试次数包含额外尝试，零重试直接保留失败进度", async t => {
  for (const maxRetries of [0, 2]) {
    let calls = 0;
    const result = await runAITranslation(fixture(t), { execution: { maxRetries, requestIntervalSeconds: 0 } }, {
      sleep: async () => {},
      requestBatch: async () => { calls++; throw new AIProviderError("暂时不可用", { retryable: true }); },
    });
    assert.equal(calls, maxRetries + 1);
    assert.equal(result.summary.error, 4);
  }
});

test("并发请求共用开始间隔，不等待前一个响应", async () => {
  let now = 1000;
  const starts = [];
  const releases = [];
  const schedule = createRequestThrottle(100, async ms => { now += ms; }, undefined, () => now);
  const tasks = Array.from({ length: 3 }, () => schedule(() => {
    starts.push(now);
    return new Promise(resolve => releases.push(resolve));
  }));
  await tick();
  assert.deepEqual(starts, [1000, 1100, 1200]);
  releases.forEach(resolve => resolve());
  await Promise.all(tasks);
});

test("致命失败后停止新批次，保留在途成功结果并等待其结束才释放文件锁", async t => {
  const source = fixture(t);
  const pending = [];
  let settled = false;
  const task = runExclusiveAITranslation(source, () => runAITranslation(source, {
    execution: { concurrency: 2, maxEntries: 1, requestIntervalSeconds: 0 },
  }, {
    requestBatch: (_config, batch) => new Promise((resolve, reject) => pending.push({ resolve: () => resolve(translated(batch)), reject })),
  }));
  const checked = assert.rejects(task, /认证失败/).then(() => { settled = true; });
  await tick();
  pending[0].reject(new AIProviderError("认证失败", { retryable: false }));
  await tick();
  assert.equal(pending.length, 2);
  assert.equal(settled, false);
  await assert.rejects(runExclusiveAITranslation(source, async () => {}), /正在翻译中/);
  pending[1].resolve();
  await checked;
  let remaining = 0;
  const result = await runAITranslation(source, { execution: { requestIntervalSeconds: 0 } }, {
    requestBatch: async (_config, batch) => { remaining += batch.length; return translated(batch); },
  });
  assert.equal(remaining, 3);
  assert.equal(result.summary.translated, 4);
});
