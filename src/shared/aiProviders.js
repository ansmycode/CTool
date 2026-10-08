// Provider presets contain public configuration only, never credentials.
export const AI_PROTOCOL_OPTIONS = Object.freeze([
  { value: 'openai-chat', label: 'OpenAI Chat Completions' },
  { value: 'openai-responses', label: 'OpenAI Responses' },
  { value: 'anthropic', label: 'Anthropic Messages' },
]);
export const AI_PROVIDER_PRESETS = Object.freeze([
  { value: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', protocol: 'openai-responses', jsonMode: true,
    models: [{ value: 'gpt-6-astra', label: 'GPT-6 Astra' }] },
  { value: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', protocol: 'openai-chat', jsonMode: true,
    models: [{ value: 'deepseek-flash', label: 'DeepSeek V4.1 Flash' }, { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' }] },
  { value: 'anthropic', label: 'Anthropic / Claude', baseUrl: 'https://api.anthropic.com/v1', protocol: 'anthropic', jsonMode: false,
    models: [{ value: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' }, { value: 'claude-haiku-5-5', label: 'Claude Haiku 5.5' }] },
  { value: 'kimi', label: 'Kimi', baseUrl: 'https://api.moonshot.ai/v1', protocol: 'openai-chat', jsonMode: true,
    models: [{ value: 'kimi-k2.6', label: 'Kimi K2.6' }, { value: 'kimi-k3', label: 'Kimi K3' }] },
  { value: 'qwen', label: '通义千问 / 百炼', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', protocol: 'openai-chat', jsonMode: true,
    models: [{ value: 'qwen-flash', label: 'Qwen Flash' }, { value: 'qwen-plus', label: 'Qwen Plus' }] },
  { value: 'zai', label: 'Z.AI / GLM', baseUrl: 'https://api.z.ai/api/paas/v4', protocol: 'openai-chat', jsonMode: false,
    models: [{ value: 'glm-5', label: 'GLM-5' }] },
  { value: 'custom', label: '自定义 / 本地模型', baseUrl: '', protocol: 'openai-chat', jsonMode: false, models: [] },
]);

export function isLocalAIAddress(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host);
}

export function validateAIBaseUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('请输入有效的 API 地址。'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('API 地址必须使用 HTTP 或 HTTPS。');
  if (url.protocol === 'http:' && !isLocalAIAddress(url.hostname)) throw new Error('非本地 API 地址必须使用 HTTPS。');
  if (url.username || url.password || url.search || url.hash) throw new Error('API 地址不能包含账号、密码、查询参数或片段。');
  return url;
}
