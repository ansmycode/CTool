import type { EngineType, GameCapability } from "@/game/types";
export interface GameLaunchOptions { fontId?: 'original' | 'noto-sans-cjk-sc'; }
export interface DetectedGame {
  gamePath: string;
  title: string;
  engine: EngineType;
  version: string;
  supported: boolean;
  supportMessage?: string;
  architecture?: "x86" | "x64" | "unknown";
  sha256?: string;
  profileId?: string;
}
export interface GameSessionSnapshot {
  translationRestore?: { state: 'loading' | 'loaded' | 'failed' | 'none'; loaded?: number; message?: string };
  launchOptions?: GameLaunchOptions;
  runtimeAvailable?: boolean;
  goldWritable?: boolean;
  inventoryWritable?: boolean;
  databaseReadOnly?: boolean;
  telemetry?: {
    gold: ({ status: "available"; value: number; observedAt: number;source?:import("@/game/database").GoldCandidate&{mode:string} }
      | { status: "unavailable"; reason: string }) & {candidates?:import("@/game/database").GoldCandidate[]};
  };
  sessionId: string;
  revision: number;
  game?: DetectedGame;
  pid?: number;
  state: "launching" | "connecting" | "initializing" | "ready" | "degraded" | "failed" | "closed";
  processState: "starting" | "running" | "exited";
  capabilities: GameCapability[];
  message: string;
}
