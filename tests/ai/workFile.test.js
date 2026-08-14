import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  getAITranslationPaths,
  inspectAITranslationSource,
  prepareAITranslationWorkFile,
} from "../../src/electron/ai/workFile.js";
import {
  createTranslationBatches,
  runTaskPool,
} from "../../src/electron/ai/batching.js";

const mockPath = path.resolve("docs/mocks/ai-translation-ja-500.json");

function createTemporarySource() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ctool-ai-test-"));
  const sourcePath = path.join(directory, "Japanese.json");
  fs.copyFileSync(mockPath, sourcePath);
  return { directory, sourcePath };
}

test("500 条 mock 默认按每批 100 条拆成 5 批", () => {
  const { directory, sourcePath } = createTemporarySource();
  try {
    assert.equal(inspectAITranslationSource(sourcePath).hasWorkFile, false);
    const prepared = prepareAITranslationWorkFile(sourcePath);
    assert.equal(prepared.summary.untranslated, 500);
    assert.equal(prepared.isComplete, false);
    assert.equal(fs.existsSync(prepared.workFilePath), true);
    assert.equal(prepared.outputFilePath, null);

    const workFile = JSON.parse(fs.readFileSync(prepared.workFilePath, "utf8"));
    const batches = createTranslationBatches(workFile.items);
    assert.equal(batches.length, 5);
    assert.equal(batches.every((batch) => batch.length === 100), true);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("重新准备工作文件会保留已完成项并合并新增项", () => {
  const { directory, sourcePath } = createTemporarySource();
  try {
    const prepared = prepareAITranslationWorkFile(sourcePath);
    const workFile = JSON.parse(fs.readFileSync(prepared.workFilePath, "utf8"));
    const firstKey = Object.keys(workFile.items)[0];
    workFile.items[firstKey] = { value: "翻译结果", status: "translated" };
    fs.writeFileSync(prepared.workFilePath, JSON.stringify(workFile, null, 2));

    const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    source["新しい文章"] = "新しい文章";
    fs.writeFileSync(sourcePath, JSON.stringify(source, null, 2));

    const merged = prepareAITranslationWorkFile(sourcePath);
    const mergedWorkFile = JSON.parse(fs.readFileSync(merged.workFilePath, "utf8"));
    assert.deepEqual(mergedWorkFile.items[firstKey], {
      value: "翻译结果",
      status: "translated",
    });
    assert.equal(mergedWorkFile.items["新しい文章"].status, "untranslated");
    assert.equal(merged.summary.translated, 1);
    assert.equal(merged.summary.untranslated, 500);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("全部完成后导出纯净 JSON 且保留工作文件", () => {
  const { directory, sourcePath } = createTemporarySource();
  try {
    const { workFilePath, outputFilePath } = getAITranslationPaths(sourcePath);
    const prepared = prepareAITranslationWorkFile(sourcePath);
    const workFile = JSON.parse(fs.readFileSync(workFilePath, "utf8"));
    for (const item of Object.values(workFile.items)) {
      item.value = `译文-${item.value}`;
      item.status = "translated";
    }
    fs.writeFileSync(workFilePath, JSON.stringify(workFile, null, 2));

    const completed = prepareAITranslationWorkFile(sourcePath);
    assert.equal(completed.isComplete, true);
    assert.equal(fs.existsSync(workFilePath), true);
    assert.equal(fs.existsSync(outputFilePath), true);
    const output = JSON.parse(fs.readFileSync(outputFilePath, "utf8"));
    assert.equal(Object.keys(output).length, 500);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("任务池维持固定并发并按原顺序返回结果", async () => {
  let running = 0;
  let maxRunning = 0;
  const results = await runTaskPool(
    [1, 2, 3, 4, 5, 6],
    async (value) => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      return value * 2;
    },
    3,
  );
  assert.equal(maxRunning, 3);
  assert.deepEqual(results, [2, 4, 6, 8, 10, 12]);
});
