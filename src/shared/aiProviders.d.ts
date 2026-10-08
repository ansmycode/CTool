export type AIProviderId = 'openai' | 'deepseek' | 'anthropic' | 'kimi' | 'qwen' | 'zai' | 'custom';
export type AIProtocol = 'openai-chat' | 'openai-responses' | 'anthropic';
export interface AIProviderPreset {
  value: AIProviderId;
  label: string;
  baseUrl: string;
  protocol: AIProtocol;
  jsonMode: boolean;
  models: Array<{ value: string; label: string }>;
}
export const AI_PROVIDER_PRESETS: ReadonlyArray<AIProviderPreset>;
export const AI_PROTOCOL_OPTIONS: ReadonlyArray<{ value: AIProtocol; label: string }>;
export function isLocalAIAddress(hostname: string): boolean;
export function validateAIBaseUrl(value: string): URL;
