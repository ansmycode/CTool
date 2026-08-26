import { getShortcutActionSupportedEngines } from "@/game/registry";
import type {
  GameShortcutAction,
  GameShortcutActionId,
} from "@/game/types";

type ShortcutActionMetadata = Omit<GameShortcutAction, "supportedEngines">;

const shortcutActionCatalog: ShortcutActionMetadata[] = [
  {
    id: "toggleThrough",
    name: "切换穿墙模式",
    description: "在开启与关闭地图碰撞之间切换",
    category: "开关",
  },
  {
    id: "toggleEncounter",
    name: "切换随机遇敌",
    description: "开启或关闭地图移动时的随机战斗",
    category: "开关",
  },
  {
    id: "toggleFormation",
    name: "切换队伍整编",
    description: "开启或关闭菜单中的队伍整编功能",
    category: "开关",
  },
  {
    id: "toggleOneHitKill",
    name: "切换一击秒杀",
    description: "开启或关闭我方角色对敌人的一击秒杀",
    category: "开关",
  },
  {
    id: "achieveVictory",
    name: "战斗直接胜利",
    description: "在战斗中立即执行胜利结算",
    category: "触发",
  },
  {
    id: "achieveDefeat",
    name: "战斗强制失败",
    description: "在战斗中立即执行战败流程",
    category: "触发",
  },
];

export function getShortcutActions(
  availableActions: ReadonlySet<GameShortcutActionId>,
): GameShortcutAction[] {
  return shortcutActionCatalog
    .filter(({ id }) => availableActions.has(id))
    .map((action) => ({
      ...action,
      supportedEngines: getShortcutActionSupportedEngines(action.id),
    }));
}
