export type AIProviderId = "openai" | "deepseek" | "kimi" | "custom";

export interface AITranslationFileSelection {
  filePath: string;
  workFilePath: string;
  outputFilePath: string | null;
  hasWorkFile: boolean;
  hasUnfinishedWork: boolean;
  summary: AITranslationSummary | null;
}

export interface AITranslationSummary {
  translated: number;
  skipped: number;
  error: number;
  untranslated: number;
}

export interface AITranslationPreparation extends AITranslationFileSelection {
  isComplete: boolean;
  summary: AITranslationSummary;
}

export interface AITranslationFormValues {
  provider: AIProviderId;
  baseUrl: string;
  apiKey: string;
  model: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export type AITranslationAPIConfig = AITranslationFormValues;

export interface AIConnectionTestResult {
  success: true;
  provider: "openai" | "deepseek";
  model: string;
}
