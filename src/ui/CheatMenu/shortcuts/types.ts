import type { GameShortcutActionId } from "@/game/types";

export type ShortcutBindings = Partial<
  Record<GameShortcutActionId, string>
>;

export type ShortcutRegistrationResults = Partial<
  Record<GameShortcutActionId, boolean>
>;
