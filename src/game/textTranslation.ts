/** Game text integration is separate from engine-independent JSON AI translation. */
export type GameTextOperation = "extract" | "load" | "embed";
export interface GameTextTranslationStatus {
  persistenceError?: string;
  status: 'available';
  loaded: number;
  hooked: boolean;
  faulted: boolean;
  replacements: number;
}

export interface GameTextExtractionResult {
  cacheDirectory: string;
  jsonPath: string;
  textCount: number;
  parsedFiles: number;
  reusedCache: boolean;
  skipped: { source: string; reason: string }[];
}

export interface GameTextTranslationAccess {
  readonly operations: Readonly<Record<GameTextOperation, {
    readonly label: string;
    readonly available: boolean;
    readonly reason: string;
  }>>;
  extract(): Promise<GameTextExtractionResult>;
  load(): Promise<GameTextTranslationStatus|null>;
  status(): Promise<GameTextTranslationStatus>;
  unload(): Promise<GameTextTranslationStatus>;
  embed(): Promise<void>;
}
