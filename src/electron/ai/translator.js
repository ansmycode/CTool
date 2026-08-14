import { createTranslationBatches, DEFAULT_BATCH_OPTIONS } from "./batching.js";
import { AIProviderError, requestTranslationBatch } from "./providerClient.js";
import {
  finishAITranslation,
  getAITranslationPaths,
  markAITranslationBatchError,
  prepareAITranslationWorkFile,
  readAITranslationWorkFile,
  saveAITranslationBatch,
} from "./workFile.js";

const MAX_ATTEMPTS = 3;
export const DEFAULT_REQUEST_INTERVAL_MS = 1000;

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function createRequestThrottle(minIntervalMs, sleep) {
  let lastRequestStartedAt = 0;
  return async (request) => {
    const remaining = minIntervalMs - (Date.now() - lastRequestStartedAt);
    if (remaining > 0) await sleep(remaining);
    lastRequestStartedAt = Date.now();
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
) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
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
      if (!(error instanceof AIProviderError) || !error.retryable || attempt === MAX_ATTEMPTS) {
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
  prepareAITranslationWorkFile(sourcePath);
  const { workFilePath } = getAITranslationPaths(sourcePath);
  const workFile = readAITranslationWorkFile(workFilePath);
  const batches = createTranslationBatches(workFile.items, {
    ...DEFAULT_BATCH_OPTIONS,
    ...options.batchOptions,
    concurrency: 1,
  });
  const requestBatch = options.requestBatch ?? requestTranslationBatch;
  const sleep = options.sleep ?? wait;
  const minRequestIntervalMs =
    options.minRequestIntervalMs ?? DEFAULT_REQUEST_INTERVAL_MS;
  const scheduleRequest = createRequestThrottle(minRequestIntervalMs, sleep);

  for (const batch of batches) {
    try {
      await processBatch(
        sourcePath,
        config,
        batch,
        options,
        requestBatch,
        scheduleRequest,
        sleep,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "当前批次翻译失败。";
      const cause = error instanceof BatchTranslationError ? error.cause : error;
      const failedBatch = error instanceof BatchTranslationError ? error.batch : batch;
      if (cause instanceof AIProviderError && !cause.retryable) throw cause;
      markAITranslationBatchError(sourcePath, failedBatch, message);
      break;
    }
  }
  return finishAITranslation(sourcePath);
}
