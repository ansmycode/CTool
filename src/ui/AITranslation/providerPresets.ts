import type { AIProviderId } from "@/types/AITranslation";

export interface AIProviderPreset {
  value: AIProviderId;
  label: string;
  baseUrl: string;
  models: Array<{ value: string; label: string }>;
  disabled?: boolean;
}

export const AI_PROVIDER_PRESETS: AIProviderPreset[] = [
  {
    value: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: [{ value: "gpt-5.6-luna", label: "GPT-5.6 Luna" }],
  },
  {
    value: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    models: [{ value: "deepseek-v4-flash", label: "DeepSeek V4 Flash" }],
  },
  {
    value: "kimi",
    label: "Kimi",
    baseUrl: "https://api.moonshot.cn/v1",
    models: [],
    disabled: true,
  },
  {
    value: "custom",
    label: "自定义",
    baseUrl: "",
    models: [],
    disabled: true,
  },
];

export const LANGUAGE_OPTIONS = [
  "简体中文",
  "繁体中文",
  "英语",
  "日语",
  "韩语",
  "法语",
  "德语",
  "西班牙语",
].map((language) => ({ value: language, label: language }));
