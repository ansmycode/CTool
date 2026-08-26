import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type {
  GameFeatureKey,
  GameFeatureState,
} from "@/game/features";

interface GameFeatureContextValue {
  features: GameFeatureState;
  refresh: (key: GameFeatureKey) => void | Promise<void>;
}

const GameFeatureContext = createContext<GameFeatureContextValue | null>(null);

interface GameFeatureProviderProps extends GameFeatureContextValue {
  children: ReactNode;
}

export function GameFeatureProvider({
  features,
  refresh,
  children,
}: GameFeatureProviderProps) {
  return (
    <GameFeatureContext.Provider value={{ features, refresh }}>
      {children}
    </GameFeatureContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGameFeature<K extends GameFeatureKey>(key: K) {
  const context = useContext(GameFeatureContext);

  if (!context) {
    throw new Error("useGameFeature 必须在 GameFeatureProvider 内使用");
  }

  return {
    data: context.features[key],
    refresh: () => context.refresh(key),
  };
}
