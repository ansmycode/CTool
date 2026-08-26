import type { GameShortcutPolicy } from "@/game/types";

export function getShortcutRestrictionReason(
  policy: GameShortcutPolicy,
  accelerator: string,
): string | null {
  const parts = accelerator.split("+");
  const key = parts.at(-1);
  const hasCtrlOrAlt = parts.some(
    (part) => part === "CommandOrControl" || part === "Alt",
  );

  if (!key || hasCtrlOrAlt) return null;
  return policy.blockedKeysWithoutCtrlOrAlt[key] ?? null;
}

export function isRiskyGlobalShortcut(accelerator: string): boolean {
  const parts = accelerator.split("+");
  return !parts.some(
    (part) => part === "CommandOrControl" || part === "Alt",
  );
}
