import type { GameSessionSnapshot } from "@/types/GameSession";
import { lazy, Suspense } from "react";
import LoadingOverlay from "@/components/LoadingOverlay";
const MvmzCheatMenu = lazy(() => import("./mvmz/MvmzCheatMenu"));
const WolfCheatMenu = lazy(() => import("./wolf/WolfCheatMenu"));

interface CheatMenuProps {
  session: GameSessionSnapshot;
  isGameStarting: boolean;
  gameInfo: NonNullable<GameSessionSnapshot['game']>;
}

/** UI routes by engine; engine-specific pages must not share runtime behavior. */
export default function CheatMenu(props: CheatMenuProps) {
  return <Suspense fallback={<LoadingOverlay visible={true} />}>{props.gameInfo.engine === "wolf"
    ? <WolfCheatMenu {...props} />
    : <MvmzCheatMenu {...props} />}</Suspense>;
}
