import type { GameSessionSnapshot } from "@/types/GameSession";
import MvmzCheatMenu from "./mvmz/MvmzCheatMenu";
import WolfCheatMenu from "./wolf/WolfCheatMenu";

interface CheatMenuProps {
  session: GameSessionSnapshot;
  isGameStarting: boolean;
  gameInfo: any;
}

/** UI routes by engine; engine-specific pages must not share runtime behavior. */
export default function CheatMenu(props: CheatMenuProps) {
  return props.gameInfo.engine === "wolf"
    ? <WolfCheatMenu {...props} />
    : <MvmzCheatMenu {...props} />;
}
