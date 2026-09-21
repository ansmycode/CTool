import { createTranslationBatches, runTaskPool } from "./batching.js";
import { normalizeAITranslationSettings, DEFAULT_AI_TRANSLATION_SETTINGS } from "../../shared/aiTranslationSettings.js";
import { AIProviderError, requestTranslationBatch } from "./providerClient.js";
import {
  finishAITranslation,
  getAITranslationPaths,
  markAITranslationBatchError,
  prepareAITranslationWorkFile,
  readAITranslationWorkFile,
  saveAITranslationBatch,
} from "./workFile.js";

export const DEFAULT_REQUEST_INTERVAL_MS = DEFAULT_AI_TRANSLATION_SETTINGS.requestIntervalSeconds * 1000;

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export function createRequestThrottle(minIntervalMs, sleep, assertRunning = () => {}, now = Date.now) {
  let lastRequestStartedAt = -Infinity;
  let queue = Promise.resolve();
  return async (request) => {
    const slot = queue.then(async () => {
      assertRunning();
      const remaining = minIntervalMs - (now() - lastRequestStartedAt);
      if (remaining > 0) await sleep(remaining);
      assertRunning();
      lastRequestStartedAt = now();
    });
    // Serialize start times only; responses can complete concurrently.
    queue = slot.catch(() => {});
    await slot;
    assertRunning();
    return request();
  };
}

async function translateWithRetry(
  config,
  batch,
  requestOptions,
  requestBatch,
  scheduleRequest,
  sleep,
  maxAttempts,
) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await scheduleRequest(() =>
        requestBatch(config, batch, requestOptions),
      );
    } catch (error) {
      lastError = error;
      if (
        error instanceof AIProviderError &&
        (error.kind === "invalid_response" || error.kind === "batch_too_large")
      ) {
        throw error;
      }
      if (!(error instanceof AIProviderError) || !error.retryable || attempt === maxAttempts) {
        throw error;
      }
      await sleep(error.retryAfterMs ?? attempt * 1000);
    }
  }
  throw lastError;
}

class BatchTranslationError extends Error {
  constructor(cause, batch) {
    super(cause instanceof Error ? cause.message : "当前批次翻译失败。");
    this.name = "BatchTranslationError";
    this.cause = cause;
    this.batch = batch;
  }
}

async function processBatch(
  sourcePath,
  config,
  batch,
  options,
  requestBatch,
  scheduleRequest,
  sleep,
) {
  try {
    const translatedItems = await translateWithRetry(
      config,
      batch,
      options.requestOptions,
      requestBatch,
      scheduleRequest,
      sleep,
      options.maxAttempts,
    );
    saveAITranslationBatch(sourcePath, translatedItems);
  } catch (error) {
    const shouldSplit =
      error instanceof AIProviderError &&
      (error.kind === "invalid_response" || error.kind === "batch_too_large") &&
      batch.length > 1;
    if (!shouldSplit) throw new BatchTranslationError(error, batch);

    const middle = Math.ceil(batch.length / 2);
    await processBatch(
      sourcePath,
      config,
      batch.slice(0, middle),
      options,
      requestBatch,
      scheduleRequest,
      sleep,
    );
    await processBatch(
      sourcePath,
      config,
      batch.slice(middle),
      options,
      requestBatch,
      scheduleRequest,
      sleep,
    );
  }
}

export async function runAITranslation(sourcePath, config, options = {}) {
  const settings = normalizeAITranslationSettings(config?.execution);
  const executionOptions = {
    ...options,
    maxAttempts: settings.maxRetries + 1,
    requestOptions: { timeoutMs: settings.requestTimeoutSeconds * 1000, ...options.requestOptions },
  };
  prepareAITranslationWorkFile(sourcePath);
  const { workFilePath } = getAITranslationPaths(sourcePath);
  const workFile = readAITranslationWorkFile(workFilePath);
  const batches = createTranslationBatches(workFile.items, {
    maxEntries: settings.maxEntries,
    maxCharacters: settings.maxCharacters,
    ...options.batchOptions,
  });
  const requestBatch = options.requestBatch ?? requestTranslationBatch;
  const sleep = options.sleep ?? wait;
  const minRequestIntervalMs =
    options.minRequestIntervalMs ?? settings.requestIntervalSeconds * 1000;
  let stopped = false;
  let fatalError;
  const stoppedError = new Error("本轮翻译已停止派发新请求。");
  const scheduleRequest = createRequestThrottle(minRequestIntervalMs, sleep, () => {
    if (stopped) throw stoppedError;
  });

  await runTaskPool(batches, async (batch) => {
    if (stopped) return;
    try {
      await processBatch(
        sourcePath,
        config,
        batch,
        executionOptions,
        requestBatch,
        scheduleRequest,
        sleep,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "当前批次翻译失败。";
      const cause = error instanceof BatchTranslationError ? error.cause : error;
      if (cause === stoppedError) return;
      stopped = true;
      const failedBatch = error instanceof BatchTranslationError ? error.batch : batch;
      if (cause instanceof AIProviderError && !cause.retryable) {
        fatalError ??= cause;
        return;
      }
      markAITranslationBatchError(sourcePath, failedBatch, message);
    }
  }, settings.concurrency);
  if (fatalError) throw fatalError;
  return finishAITranslation(sourcePath);
}
