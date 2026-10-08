import type { AIProviderId, AIProtocol } from '@/shared/aiProviders.js';
export type { AIProviderId, AIProtocol } from '@/shared/aiProviders.js';

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

export interface AITranslationTaskStatus {
  running: boolean;
  stopping: boolean;
  startedAt: number | null;
  file: AITranslationFileSelection;
}

export interface AITranslationPreparation extends AITranslationFileSelection {
  isComplete: boolean;
  summary: AITranslationSummary;
}

export interface AITranslationFormValues {
  provider: AIProviderId;
  protocol?: AIProtocol;
  jsonMode?: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
  sourceLanguage: string;
  targetLanguage: string;
  execution?: Partial<import("@/shared/aiTranslationSettings.js").AITranslationSettings>;
}

export type AITranslationAPIConfig = AITranslationFormValues;

export interface AIConnectionTestResult {
  success: true;
  provider: AIProviderId;
  model: string;
}
