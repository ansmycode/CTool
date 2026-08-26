import mvmzAdapter from "@/game/adapters/mvmz";
import type {
  EngineType,
  GameEngineAdapter,
  GameShortcutActionId,
} from "@/game/types";

const engineAdapters: Partial<
  Record<NonNullable<EngineType>, GameEngineAdapter>
> = {
  MV: mvmzAdapter,
  MZ: mvmzAdapter,
};

export function getEngineAdapter(engineType: EngineType): GameEngineAdapter {
  const adapter = engineType ? engineAdapters[engineType] : undefined;

  if (!adapter) {
    throw new Error(`不支持的引擎类型: ${engineType}`);
  }

  return adapter;
}

export function getShortcutActionSupportedEngines(
  actionId: GameShortcutActionId,
): NonNullable<EngineType>[] {
  return (Object.entries(engineAdapters) as [
    NonNullable<EngineType>,
    GameEngineAdapter,
  ][])
    .filter(([, adapter]) => adapter.shortcutActions.has(actionId))
    .map(([engine]) => engine);
}
