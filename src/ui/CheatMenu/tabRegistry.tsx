import { lazy, Suspense } from "react";
import { Spin } from "antd";
import type { ReactNode } from "react";
import type { TabsProps } from "antd";
import type { GameFeatureKey } from "@/game/features";
import type {
  GameCapability,
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
  runtime?: ReactNode;
  collections?: {key:string;label:string;children:ReactNode}[];
  database?: ReactNode;
  gameInfo: any;
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
  feature?: GameFeatureKey;
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
    capability: "overview",
    feature: "overview",
    render: (context) => (
      <Home
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
    feature: "items",
    render: (context) => (
      <ItemsTable
        handleGainItem={context.gainItem}
      />
    ),
  },
  {
    key: "3",
    label: "物品: 防具",
    capability: "armors",
    feature: "armors",
    render: (context) => (
      <ArmorTable
        handleGainItem={context.gainItem}
      />
    ),
  },
  {
    key: "4",
    label: "物品: 武器",
    capability: "weapons",
    feature: "weapons",
    render: (context) => (
      <WeaponTable
        handleGainItem={context.gainItem}
      />
    ),
  },
  {
    key: "5",
    label: "变量",
    capability: "variables",
    feature: "variables",
    render: (context) => (
      <VariablesTable
        changeVariables={context.modifyVariable}
      />
    ),
  },
  {
    key: "6",
    label: "开关",
    capability: "switches",
    feature: "switches",
    render: (context) => (
      <SwitchesTable
        changeSwitches={context.modifySwitch}
      />
    ),
  },
  {
    key: "7",
    label: "角色",
    capability: "actors",
    feature: "actors",
    render: (context) => (
      <ActorTable
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

export function getTabFeatureKey(tabKey: string) {
  return tabDefinitions.find(({ key }) => key === tabKey)?.feature;
}

export function createCheatMenuTabs(
  capabilities: ReadonlySet<GameCapability>,
  context: CheatMenuContext,
): TabsProps["items"] {
  const runtimeTabs = context.runtime ? [
    {key:"runtime",label:"游戏控制台",children:context.runtime,className:"tab-pane-fullheight"},
    ...(context.collections??[]).map(tab=>({...tab,className:"tab-pane-fullheight"})),
    ...(import.meta.env.DEV&&context.database?[{key:"database",label:"数据库调试（DEV）",children:context.database,className:"tab-pane-fullheight"}]:[]),
  ] : [];
  return [...runtimeTabs,...tabDefinitions
    .filter(({key})=>key!=="9"||context.shortcutActions.length>0)
    .filter(({ capability }) => !capability || capabilities.has(capability))
    .map(({ key, label, render }) => ({
      key,
      label,
      children: withPageFallback(render(context)),
      className: "tab-pane-fullheight",
    }))];
}
