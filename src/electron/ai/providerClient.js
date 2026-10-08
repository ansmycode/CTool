import { abortable } from './cancellation.js';
import { AI_PROVIDER_PRESETS, AI_PROTOCOL_OPTIONS, isLocalAIAddress, validateAIBaseUrl } from '../../shared/aiProviders.js';

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
  const base = baseUrl.replace(/\/+$/, '');
  const url = new URL(base);
  const knownEndpoint = /\/(chat\/completions|responses|messages)$/.test(url.pathname);
  if (url.pathname.endsWith(pathname)) return base;
  if (knownEndpoint) throw new AIProviderError('API 完整端点与所选协议不一致。');
  return `${base}${pathname}`;
}

function assertConfig(config) {
  const preset = AI_PROVIDER_PRESETS.find(item => item.value === config?.provider);
  if (!preset) {
    throw new AIProviderError("请选择有效的 AI 服务商。", {
      retryable: false,
    });
  }
  for (const [field, label] of [
    ["baseUrl", "API 地址"],
    ["model", "模型"],
    ["sourceLanguage", "源语言"],
    ["targetLanguage", "目标语言"],
  ]) {
    if (typeof config[field] !== "string" || !config[field].trim()) {
      throw new AIProviderError(`${label}不能为空。`, { retryable: false });
    }
  }
  let url;
  try { url = validateAIBaseUrl(config.baseUrl); }
  catch (error) { throw new AIProviderError(error.message); }
  if (config.apiKey !== undefined && typeof config.apiKey !== 'string') throw new AIProviderError('API Key 格式无效。');
  if (!config.apiKey?.trim() && !(config.provider === 'custom' && isLocalAIAddress(url.hostname))) throw new AIProviderError('API Key 不能为空。');
  const protocol = config.protocol ?? preset.protocol;
  if (!AI_PROTOCOL_OPTIONS.some(item => item.value === protocol)) throw new AIProviderError('请选择有效的 API 协议。');
  if (config.jsonMode !== undefined && typeof config.jsonMode !== 'boolean') throw new AIProviderError('JSON 输出配置必须为布尔值。');
  return { ...config, baseUrl: config.baseUrl.trim(), apiKey: config.apiKey?.trim() ?? '', protocol, jsonMode: config.jsonMode ?? preset.jsonMode };
}

function friendlyHttpError(status) {
  if (status === 401 || status === 403) return "API Key 无效或没有访问权限。";
  if (status === 404) return "API 地址或模型端点不存在。";
  if (status === 429) return "请求过于频繁或额度不足，请稍后重试。";
  if (status === 413) return "当前翻译批次过大。";
  if (status >= 500) return "AI 服务暂时不可用，请稍后重试。";
  if (status === 400 || status === 422) return '请求配置被服务商拒绝，请检查模型、协议及 JSON 输出选项。';
  return `AI 服务请求失败（HTTP ${status}）。`;
}

async function postJson(url, body, headers, { timeoutMs = 120000, fetchImpl = fetch, signal } = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  const timer = setTimeout(() => controller.abort(new AIProviderError('AI 服务响应超时。', { retryable: true })), timeoutMs);
  try {
    let response;
    try {
      response = await abortable(() => fetchImpl(url, {
        method: "POST",
        headers: { 'Content-Type': 'application/json', ...headers },
        redirect: 'error',
        body: JSON.stringify(body),
        signal: controller.signal,
      }), controller.signal);
    } catch (error) {
      if (controller.signal.aborted) throw controller.signal.reason;
      throw new AIProviderError("无法连接 AI 服务，请检查网络和 API 地址。", {
        retryable: true,
      });
    }

    let rawText;
    try { rawText = await abortable(() => response.text(), controller.signal); }
    catch {
      if (controller.signal.aborted) throw controller.signal.reason;
      throw new AIProviderError('AI 响应读取中断，请重试。', { retryable: true });
    }
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
      const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
      throw new AIProviderError(friendlyHttpError(response.status), {
        retryable: response.status === 408 || response.status === 429 || response.status >= 500,
        status: response.status,
        kind: response.status === 413 ? "batch_too_large" : "request",
        retryAfterMs,
      });
    }
    return data;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

function extractOpenAIText(response) {
  if (response?.status === 'incomplete') throw new AIProviderError('AI 输出未完成，请减小翻译批次。', { kind: 'invalid_response', retryable: true });
  if (typeof response?.output_text === "string") return response.output_text;
  const textParts = [];
  for (const output of Array.isArray(response?.output) ? response.output : []) {
    for (const content of Array.isArray(output?.content) ? output.content : []) {
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

function extractChatText(response) {
  if (response?.choices?.[0]?.finish_reason === 'length') throw new AIProviderError('AI 输出达到长度上限，请减小翻译批次。', { kind: 'invalid_response', retryable: true });
  const message = response?.choices?.[0]?.message?.content;
  if (typeof message !== "string" || !message.trim()) {
    throw new AIProviderError("AI 响应中没有文本内容。", {
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
  const officialAstra = new URL(config.baseUrl).hostname === 'api.openai.com' && /^gpt-6-astra(?:-|$)/.test(config.model);
  return {
    url: endpoint(config.baseUrl, "/responses"),
    body: {
      model: config.model,
      input: [
        { role: "system", content: instruction },
        { role: "user", content: input },
      ],
      ...(officialAstra ? { reasoning: { effort: 'low' } } : {}),
      ...(config.jsonMode ? { text: { format: { type: 'json_object' } } } : {}),
      max_output_tokens: maxOutputTokens,
      stream: false,
    },
    extractText: extractOpenAIText,
  };
}

function chatRequest(config, instruction, input, maxOutputTokens) {
  const host = new URL(config.baseUrl).hostname;
  const officialDeepSeek = config.provider === 'deepseek' && host === 'api.deepseek.com';
  const officialOpenAI = config.provider === 'openai' && host === 'api.openai.com';
  const officialQwen = config.provider === 'qwen' && host === 'dashscope.aliyuncs.com' && /^qwen-(flash|plus)$/.test(config.model);
  const officialKimi = config.provider === 'kimi' && ['api.moonshot.ai', 'api.moonshot.cn'].includes(host);
  return {
    url: endpoint(config.baseUrl, "/chat/completions"),
    body: {
      model: config.model,
      messages: [
        { role: "system", content: instruction },
        { role: "user", content: input },
      ],
      ...(config.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      ...(officialDeepSeek || (officialKimi && config.model === 'kimi-k2.6') ? { thinking: { type: 'disabled' } } : {}),
      ...(officialKimi && config.model === 'kimi-k3' ? { reasoning_effort: 'low' } : {}),
      ...(officialQwen ? { enable_thinking: false } : {}),
      ...(officialOpenAI ? { max_completion_tokens: maxOutputTokens } : { max_tokens: maxOutputTokens }),
      ...(officialOpenAI && /^gpt-6-astra(?:-|$)/.test(config.model) ? { reasoning_effort: 'low' } : {}),
      stream: false,
    },
    extractText: extractChatText,
  };
}

function extractAnthropicText(response) {
  if (response?.stop_reason === 'max_tokens') throw new AIProviderError('AI 输出达到长度上限，请减小翻译批次。', { kind: 'invalid_response', retryable: true });
  const text = (Array.isArray(response?.content) ? response.content : []).filter(item => item?.type === 'text' && typeof item.text === 'string').map(item => item.text).join('');
  if (!text?.trim()) throw new AIProviderError('AI 响应中没有文本内容。', { kind: 'invalid_response', retryable: true });
  return text;
}

function anthropicRequest(config, instruction, input, maxOutputTokens) {
  const base = config.baseUrl.replace(/\/+$/, '');
  const path = new URL(base).pathname;
  return {
    url: endpoint(base, /\/v1(?:\/messages)?$/.test(path) ? '/messages' : '/v1/messages'),
    body: { model: config.model, system: instruction, messages: [{ role: 'user', content: input }], max_tokens: maxOutputTokens, stream: false },
    extractText: extractAnthropicText,
  };
}

function createRequest(config, instruction, input, maxOutputTokens) {
  const request = config.protocol === 'anthropic' ? anthropicRequest(config, instruction, input, maxOutputTokens)
    : config.protocol === 'openai-responses' ? openAIRequest(config, instruction, input, maxOutputTokens)
    : chatRequest(config, instruction, input, maxOutputTokens);
  request.headers = config.protocol === 'anthropic'
    ? { 'anthropic-version': '2023-06-01', ...(config.apiKey ? { 'x-api-key': config.apiKey } : {}) }
    : config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {};
  return request;
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
  config = assertConfig(config);
  const instruction = '这是连接测试。只返回有效 JSON 对象，例如 {"ok":true}。';
  const request = createRequest(config, instruction, '返回 JSON：{"ok":true}', 1024);
  const response = await postJson(request.url, request.body, request.headers, {
    timeoutMs: 30000,
    ...options,
  });
  request.extractText(response);
  return { success: true, provider: config.provider, model: config.model };
}

export async function requestTranslationBatch(config, batch, options = {}) {
  config = assertConfig(config);
  if (!Array.isArray(batch) || batch.length === 0) {
    throw new AIProviderError("翻译批次不能为空。", { retryable: false });
  }
  const instruction = jsonOutputInstruction(config.sourceLanguage, config.targetLanguage);
  const input = JSON.stringify({ items: batch });
  const inputCharacters = batch.reduce((total, item) => total + item.value.length, 0);
  const maxOutputTokens = Math.min(8000, Math.max(1024, inputCharacters * 2 + batch.length * 64));
  const request = createRequest(config, instruction, input, maxOutputTokens);
  const response = await postJson(request.url, request.body, request.headers, options);
  return validateTranslationItems(batch, parseTranslationOutput(request.extractText(response)));
}

export { AIProviderError };
