const SUPPORTED_PROVIDERS = new Set(["openai", "deepseek"]);

class AIProviderError extends Error {
  constructor(
    message,
    {
      retryable = false,
      status = null,
      kind = "request",
      retryAfterMs = null,
    } = {},
  ) {
    super(message);
    this.name = "AIProviderError";
    this.retryable = retryable;
    this.status = status;
    this.kind = kind;
    this.retryAfterMs = retryAfterMs;
  }
}

function parseRetryAfter(value) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const timestamp = Date.parse(value);
  if (!Number.isNaN(timestamp)) return Math.max(0, timestamp - Date.now());
  return null;
}

function endpoint(baseUrl, pathname) {
  return `${baseUrl.replace(/\/+$/, "")}${pathname}`;
}

function assertConfig(config) {
  if (!SUPPORTED_PROVIDERS.has(config?.provider)) {
    throw new AIProviderError("当前阶段仅支持 OpenAI 和 DeepSeek。", {
      retryable: false,
    });
  }
  for (const [field, label] of [
    ["baseUrl", "API 地址"],
    ["apiKey", "API Key"],
    ["model", "模型"],
    ["sourceLanguage", "源语言"],
    ["targetLanguage", "目标语言"],
  ]) {
    if (typeof config[field] !== "string" || !config[field].trim()) {
      throw new AIProviderError(`${label}不能为空。`, { retryable: false });
    }
  }
  let url;
  try {
    url = new URL(config.baseUrl);
  } catch {
    throw new AIProviderError("API 地址无效。", { retryable: false });
  }
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !isLocal) {
    throw new AIProviderError("非本地 API 地址必须使用 HTTPS。", {
      retryable: false,
    });
  }
}

function friendlyHttpError(status, providerMessage) {
  if (status === 401 || status === 403) return "API Key 无效或没有访问权限。";
  if (status === 404) return "API 地址或模型端点不存在。";
  if (status === 429) return "请求过于频繁或额度不足，请稍后重试。";
  if (status === 413) return "当前翻译批次过大。";
  if (status >= 500) return "AI 服务暂时不可用，请稍后重试。";
  if (status === 400 && providerMessage) {
    return `请求配置被服务商拒绝：${String(providerMessage).slice(0, 180)}`;
  }
  return `AI 服务请求失败（HTTP ${status}）。`;
}

async function postJson(url, body, apiKey, { timeoutMs = 120000, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response;
    try {
      response = await fetchImpl(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new AIProviderError("AI 服务响应超时。", { retryable: true });
      }
      throw new AIProviderError("无法连接 AI 服务，请检查网络和 API 地址。", {
        retryable: true,
      });
    }

    const rawText = await response.text();
    let data = null;
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        if (response.ok) {
          throw new AIProviderError("AI 服务返回了无法解析的数据。", {
            retryable: true,
            status: response.status,
            kind: "invalid_response",
          });
        }
      }
    }
    if (!response.ok) {
      const providerMessage = data?.error?.message ?? data?.message;
      const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
      throw new AIProviderError(friendlyHttpError(response.status, providerMessage), {
        retryable: response.status === 408 || response.status === 429 || response.status >= 500,
        status: response.status,
        kind: response.status === 413 ? "batch_too_large" : "request",
        retryAfterMs,
      });
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function extractOpenAIText(response) {
  if (typeof response?.output_text === "string") return response.output_text;
  const textParts = [];
  for (const output of response?.output ?? []) {
    for (const content of output?.content ?? []) {
      if (typeof content?.text === "string") textParts.push(content.text);
    }
  }
  if (!textParts.length) {
    throw new AIProviderError("OpenAI 响应中没有文本内容。", {
      retryable: true,
      kind: "invalid_response",
    });
  }
  return textParts.join("");
}

function extractDeepSeekText(response) {
  const message = response?.choices?.[0]?.message?.content;
  if (typeof message !== "string" || !message.trim()) {
    throw new AIProviderError("DeepSeek 响应中没有文本内容。", {
      retryable: true,
      kind: "invalid_response",
    });
  }
  return message;
}

function jsonOutputInstruction(sourceLanguage, targetLanguage) {
  return [
    `你是游戏文本翻译器。将 value 从${sourceLanguage}翻译为${targetLanguage}。`,
    "必须逐项保留 key，条目数量及顺序必须与输入完全一致。",
    '只输出 JSON 对象，格式为 {"items":[{"key":"原 key","value":"译文","status":"translated"}]}。',
    'status 只能是 "translated" 或 "skipped"。仅纯数字、符号、代码或无需翻译的占位内容可标记 skipped，且 value 必须保持原文。',
    "不要输出 Markdown、解释或 JSON 之外的任何内容。",
  ].join("\n");
}

function openAIRequest(config, instruction, input, maxOutputTokens) {
  return {
    url: endpoint(config.baseUrl, "/responses"),
    body: {
      model: config.model,
      input: [
        { role: "system", content: instruction },
        { role: "user", content: input },
      ],
      reasoning: { effort: "none" },
      max_output_tokens: maxOutputTokens,
    },
    extractText: extractOpenAIText,
  };
}

function deepSeekRequest(config, instruction, input, maxOutputTokens) {
  return {
    url: endpoint(config.baseUrl, "/chat/completions"),
    body: {
      model: config.model,
      messages: [
        { role: "system", content: instruction },
        { role: "user", content: input },
      ],
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
      max_tokens: maxOutputTokens,
      stream: false,
    },
    extractText: extractDeepSeekText,
  };
}

function createRequest(config, instruction, input, maxOutputTokens) {
  return config.provider === "openai"
    ? openAIRequest(config, instruction, input, maxOutputTokens)
    : deepSeekRequest(config, instruction, input, maxOutputTokens);
}

function parseTranslationOutput(text) {
  let normalized = text.trim();
  const fenced = normalized.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) normalized = fenced[1];
  let parsed;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    throw new AIProviderError("AI 返回的译文不是有效 JSON。", {
      retryable: true,
      kind: "invalid_response",
    });
  }
  if (!parsed || !Array.isArray(parsed.items)) {
    throw new AIProviderError("AI 返回的 JSON 缺少 items 数组。", {
      retryable: true,
      kind: "invalid_response",
    });
  }
  return parsed.items;
}

export function validateTranslationItems(batch, translatedItems) {
  if (translatedItems.length !== batch.length) {
    throw new AIProviderError("AI 返回的条目数量与请求不一致。", {
      retryable: true,
      kind: "invalid_response",
    });
  }
  const expected = new Map(batch.map((item) => [item.key, item]));
  const seen = new Set();
  const validated = {};
  for (const item of translatedItems) {
    if (!item || typeof item.key !== "string" || !expected.has(item.key) || seen.has(item.key)) {
      throw new AIProviderError("AI 返回了未知或重复的 key。", {
        retryable: true,
        kind: "invalid_response",
      });
    }
    if (typeof item.value !== "string" || !item.value.trim()) {
      throw new AIProviderError(`key“${item.key}”的译文为空。`, {
        retryable: true,
        kind: "invalid_response",
      });
    }
    if (item.status !== "translated" && item.status !== "skipped") {
      throw new AIProviderError(`key“${item.key}”的状态无效。`, {
        retryable: true,
        kind: "invalid_response",
      });
    }
    if (item.status === "skipped" && item.value !== expected.get(item.key).value) {
      throw new AIProviderError(`key“${item.key}”跳过时修改了原文。`, {
        retryable: true,
        kind: "invalid_response",
      });
    }
    seen.add(item.key);
    validated[item.key] = { value: item.value, status: item.status };
  }
  return validated;
}

export async function testAIProviderConnection(config, options = {}) {
  assertConfig(config);
  const instruction = '这是连接测试。只返回有效 JSON 对象，例如 {"ok":true}。';
  const request = createRequest(config, instruction, '返回 JSON：{"ok":true}', 32);
  const response = await postJson(request.url, request.body, config.apiKey, {
    timeoutMs: 30000,
    ...options,
  });
  request.extractText(response);
  return { success: true, provider: config.provider, model: config.model };
}

export async function requestTranslationBatch(config, batch, options = {}) {
  assertConfig(config);
  if (!Array.isArray(batch) || batch.length === 0) {
    throw new AIProviderError("翻译批次不能为空。", { retryable: false });
  }
  const instruction = jsonOutputInstruction(config.sourceLanguage, config.targetLanguage);
  const input = JSON.stringify({ items: batch });
  const inputCharacters = batch.reduce((total, item) => total + item.value.length, 0);
  const maxOutputTokens = Math.min(8000, Math.max(1024, inputCharacters * 2));
  const request = createRequest(config, instruction, input, maxOutputTokens);
  const response = await postJson(request.url, request.body, config.apiKey, options);
  return validateTranslationItems(batch, parseTranslationOutput(request.extractText(response)));
}

export { AIProviderError };
