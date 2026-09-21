export interface AITranslationSettings {
  concurrency: number;
  maxEntries: number;
  maxCharacters: number;
  requestIntervalSeconds: number;
  requestTimeoutSeconds: number;
  maxRetries: number;
}
export const DEFAULT_AI_TRANSLATION_SETTINGS: Readonly<AITranslationSettings>;
export const AI_TRANSLATION_SETTING_FIELDS: ReadonlyArray<Readonly<{
  key: keyof AITranslationSettings;
  label: string;
  min: number;
  max: number;
  step: number;
  precision: number;
  defaultValue: number;
  unit: string;
  help: string;
}>>;
export function normalizeAITranslationSettings(input?: Partial<AITranslationSettings>): AITranslationSettings;
