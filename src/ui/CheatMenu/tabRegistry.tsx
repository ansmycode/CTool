import { lazy, Suspense } from "react";
import { Spin } from "antd";
import type { ReactNode } from "react";
import type { TabsProps } from "antd";
import type {
  GameCapability,
  GameData,
  GameShortcutAction,
  GameShortcutActionId,
  GameShortcutPolicy,
} from "@/game/types";
import type {
  ShortcutBindings,
  ShortcutRegistrationResults,
} from "./shortcuts/types";

const Home = lazy(() => import("./home/index"));
const ItemsTable = lazy(() => import("./itemsTable/index"));
const ArmorTable = lazy(() => import("./armorTable/index"));
const WeaponTable = lazy(() => import("./weaponTable/index"));
const VariablesTable = lazy(() => import("./variablesTable/index"));
const SwitchesTable = lazy(() => import("./switchesTable/index"));
const ActorTable = lazy(() => import("./actorTable/index"));
const TranslateTool = lazy(() => import("./translateTool/index"));
const ShortcutSettings = lazy(() => import("./shortcuts/index"));

interface CheatMenuContext {
  gameData: GameData | null;
  gameInfo: any;
  getGameData: () => void;
  modifyGold: (amount: number) => Promise<void>;
  modifyVariable: (id: number, value: number | string) => Promise<void>;
  modifySwitch: (id: number, value: boolean) => Promise<void>;
  gainItem: (id: number, count: number, gainType: string) => Promise<void>;
  setInTeam: (ids: Array<number>) => Promise<void>;
  setActorData: (actor: any) => Promise<void>;
  sendTranslationData: (translated: any) => Promise<void>;
  achieveVictory: () => Promise<void>;
  achieveDefeat: () => Promise<void>;
  escapeBattle: () => Promise<void>;
  setSomeGameSettings: (type: string, value: any) => Promise<void>;
  shortcutActions: GameShortcutAction[];
  shortcutBindings: ShortcutBindings;
  shortcutRegistrationResults: ShortcutRegistrationResults;
  shortcutsEnabled: boolean;
  shortcutPolicy: GameShortcutPolicy;
  setShortcutsEnabled: (enabled: boolean) => void;
  setShortcutBinding: (
    actionId: GameShortcutActionId,
    accelerator: string | null,
  ) => void;
}

interface CheatMenuTabDefinition {
  key: string;
  label: string;
  capability?: GameCapability;
  render: (context: CheatMenuContext) => ReactNode;
}

const withPageFallback = (children: ReactNode) => (
  <Suspense
    fallback={
      <div className="cheat-menu-page-loading">
        <Spin size="large" />
      </div>
    }
  >
    {children}
  </Suspense>
);

const tabDefinitions: CheatMenuTabDefinition[] = [
  {
    key: "1",
    label: "主页",
    capability: "gold",
    render: (context) => (
      <Home
        rpgGameData={context.gameData}
        getGameData={context.getGameData}
        handleAchieveVictory={context.achieveVictory}
        handleAchieveDefeat={context.achieveDefeat}
        handleEscapeBattle={context.escapeBattle}
        modifyGold={context.modifyGold}
        setSomeGameSettings={context.setSomeGameSettings}
      />
    ),
  },
  {
    key: "2",
    label: "物品: 道具",
    capability: "items",
    render: (context) => (
      <ItemsTable
        ItemsData={context.gameData?.items}
        handleGainItem={context.gainItem}
      />
    ),
  },
  {
    key: "3",
    label: "物品: 防具",
    capability: "armors",
    render: (context) => (
      <ArmorTable
        ArmorsData={context.gameData?.armors}
        handleGainItem={context.gainItem}
      />
    ),
  },
  {
    key: "4",
    label: "物品: 武器",
    capability: "weapons",
    render: (context) => (
      <WeaponTable
        WeaponsData={context.gameData?.weapons}
        handleGainItem={context.gainItem}
      />
    ),
  },
  {
    key: "5",
    label: "变量",
    capability: "variables",
    render: (context) => (
      <VariablesTable
        variables={context.gameData?.variables}
        changeVariables={context.modifyVariable}
      />
    ),
  },
  {
    key: "6",
    label: "开关",
    capability: "switches",
    render: (context) => (
      <SwitchesTable
        switches={context.gameData?.switches}
        changeSwitches={context.modifySwitch}
      />
    ),
  },
  {
    key: "7",
    label: "角色",
    capability: "actors",
    render: (context) => (
      <ActorTable
        actorData={context.gameData?.actors ?? []}
        classData={context.gameData?.classes ?? []}
        setActorInTeam={context.setInTeam}
        setActorData={context.setActorData}
      />
    ),
  },
  {
    key: "8",
    label: "翻译",
    capability: "translation",
    render: (context) => (
      <TranslateTool
        gameInfo={context.gameInfo}
        sendTranslationData={context.sendTranslationData}
      />
    ),
  },
  {
    key: "9",
    label: "快捷键",
    render: (context) => (
      <ShortcutSettings
        actions={context.shortcutActions}
        bindings={context.shortcutBindings}
        registrationResults={context.shortcutRegistrationResults}
        enabled={context.shortcutsEnabled}
        policy={context.shortcutPolicy}
        onEnabledChange={context.setShortcutsEnabled}
        onBindingChange={context.setShortcutBinding}
      />
    ),
  },
];

export function createCheatMenuTabs(
  capabilities: ReadonlySet<GameCapability>,
  context: CheatMenuContext,
): TabsProps["items"] {
  return tabDefinitions
    .filter(({ capability }) => !capability || capabilities.has(capability))
    .map(({ key, label, render }) => ({
      key,
      label,
      children: withPageFallback(render(context)),
      className: "tab-pane-fullheight",
    }));
}
