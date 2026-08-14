import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AIProviderError } from "../../src/electron/ai/providerClient.js";
import { runExclusiveAITranslation } from "../../src/electron/ai/taskRegistry.js";
import { runAITranslation } from "../../src/electron/ai/translator.js";

test("同一个文件不能同时启动两个翻译任务", async () => {
  let release;
  const waiting = new Promise((resolve) => { release = resolve; });
  const first = runExclusiveAITranslation("same.json", () => waiting);
  await assert.rejects(
    () => runExclusiveAITranslation("same.json", async () => {}),
    /正在翻译中/,
  );
  release();
  await first;
  await runExclusiveAITranslation("same.json", async () => {});
});

test("格式错误的大批次会自动减半并保存结果", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ctool-ai-split-"));
  const sourcePath = path.join(directory, "source.json");
  fs.writeFileSync(sourcePath, JSON.stringify({ A: "A", B: "B", C: "C", D: "D" }));
  const sizes = [];
  try {
    const result = await runAITranslation(
      sourcePath,
      {},
      {
        batchOptions: { maxEntries: 4, maxCharacters: 1000 },
        minRequestIntervalMs: 0,
        requestBatch: async (_config, batch) => {
          sizes.push(batch.length);
          if (batch.length > 2) {
            throw new AIProviderError("返回格式错误", {
              retryable: true,
              kind: "invalid_response",
            });
          }
          return Object.fromEntries(
            batch.map((item) => [item.key, { value: `译文-${item.value}`, status: "translated" }]),
          );
        },
      },
    );
    assert.deepEqual(sizes, [4, 2, 2]);
    assert.equal(result.isComplete, true);
    assert.equal(result.summary.translated, 4);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("批量请求之间会应用最小时间间隔", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ctool-ai-rate-"));
  const sourcePath = path.join(directory, "source.json");
  fs.writeFileSync(sourcePath, JSON.stringify({ A: "A", B: "B" }));
  const waits = [];
  try {
    await runAITranslation(
      sourcePath,
      {},
      {
        batchOptions: { maxEntries: 1, maxCharacters: 1000 },
        minRequestIntervalMs: 1000,
        sleep: async (milliseconds) => waits.push(milliseconds),
        requestBatch: async (_config, batch) => ({
          [batch[0].key]: {
            value: `译文-${batch[0].value}`,
            status: "translated",
          },
        }),
      },
    );
    assert.equal(waits.length, 1);
    assert.ok(waits[0] > 0 && waits[0] <= 1000);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
