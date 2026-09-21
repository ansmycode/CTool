// Shared by the form and the main process. Contains no credentials or I/O.
export const AI_TRANSLATION_SETTING_FIELDS = Object.freeze(
  [
    {
      key: "concurrency",
      label: "并发请求数",
      min: 1,
      max: 16,
      step: 1,
      precision: 0,
      defaultValue: 1,
      unit: "个",
      help: "同时进行的翻译请求上限。过高可能触发服务商限流。",
    },
    {
      key: "maxEntries",
      label: "每批最多条目",
      min: 1,
      max: 1000,
      step: 1,
      precision: 0,
      defaultValue: 100,
      unit: "条",
      help: "每个请求最多翻译多少条 JSON 文本，不是文本中的换行数。",
    },
    {
      key: "maxCharacters",
      label: "每批字符上限",
      min: 1,
      max: 200000,
      step: 1000,
      precision: 0,
      defaultValue: 12000,
      unit: "字符",
      help: "按 key 与原文合计分批，同时受条目上限约束；超长单条独立发送。此值不是 Token 上限。",
    },
    {
      key: "requestIntervalSeconds",
      label: "请求最小间隔",
      min: 0,
      max: 60,
      step: 0.1,
      precision: 1,
      defaultValue: 1,
      unit: "秒",
      help: "所有并发请求共用的发起间隔，重试也遵循此设置。0 表示不额外限速。",
    },
    {
      key: "requestTimeoutSeconds",
      label: "单次请求超时",
      min: 1,
      max: 600,
      step: 1,
      precision: 0,
      defaultValue: 120,
      unit: "秒",
      help: "单次翻译请求的最长等待时间，不是整个任务的时限。",
    },
    {
      key: "maxRetries",
      label: "失败重试次数",
      min: 0,
      max: 10,
      step: 1,
      precision: 0,
      defaultValue: 2,
      unit: "次",
      help: "临时网络错误、超时或限流后的额外尝试次数。格式错误或批次过大仍会自动拆批。",
    },
  ].map(Object.freeze),
);

export const DEFAULT_AI_TRANSLATION_SETTINGS = Object.freeze(
  Object.fromEntries(
    AI_TRANSLATION_SETTING_FIELDS.map((field) => [
      field.key,
      field.defaultValue,
    ]),
  ),
);

export function normalizeAITranslationSettings(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("高级翻译配置必须是有效对象。");
  }
  const settings = { ...DEFAULT_AI_TRANSLATION_SETTINGS };
  for (const field of AI_TRANSLATION_SETTING_FIELDS) {
    const value = input[field.key];
    if (value === undefined) continue;
    const scaled = value * 10 ** field.precision;
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < field.min ||
      value > field.max ||
      Math.abs(scaled - Math.round(scaled)) > 1e-7
    ) {
      throw new Error(
        `${field.label}必须为 ${field.min}–${field.max} 范围内${field.precision ? "最多一位小数的数值" : "的整数"}。`,
      );
    }
    settings[field.key] = value;
  }
  return settings;
}
