export { AI_PROVIDER_PRESETS, AI_PROTOCOL_OPTIONS } from '@/shared/aiProviders.js';
export type { AIProviderPreset } from '@/shared/aiProviders.js';

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
