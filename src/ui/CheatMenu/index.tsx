import React, { useCallback, useEffect, useRef, useState } from "react";
import { notification, Tabs } from "antd";
import { CloseCircleOutlined, LoadingOutlined } from "@ant-design/icons";
import LoadingOverlay from "@/components/LoadingOverlay";
import { GameFeatureProvider } from "@/game/GameFeatureContext";
import { useGameFeatures } from "@/game/useGameFeatures";
import { getShortcutRestrictionReason } from "@/game/shortcutPolicy";
import { createCheatMenuTabs, getTabFeatureKey } from "./tabRegistry";
import type { GameFeatureKey } from "@/game/features";
import type { GameShortcutActionId } from "@/game/types";
import type {
  ShortcutBindings,
  ShortcutRegistrationResults,
} from "./shortcuts/types";
import "./index.css";
import RuntimeConsole from "./RuntimeConsole";
import CollectionBrowser from "./CollectionBrowser";
import type {GameCollection} from "@/game/database";
const DatabaseBrowser = import.meta.env.DEV ? React.lazy(()=>import("@/ui/Main/DatabaseBrowser")) : null;

import type { GameSessionSnapshot } from "@/types/GameSession";

interface GameProps {
  session: GameSessionSnapshot;
  isGameStarting: boolean;
  gameInfo: any;
}

const SHORTCUT_STORAGE_KEY = "ctool:shortcut-bindings:v1";
const SHORTCUT_ENABLED_STORAGE_KEY = "ctool:shortcuts-enabled:v1";
const isDatabaseStartingError = (error: unknown) =>
  /database_not_ready|数据库尚未初始化/.test(
    String(error instanceof Error ? error.message : error),
  );

function loadShortcutBindings(): ShortcutBindings {
  try {
    const stored = localStorage.getItem(SHORTCUT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function loadShortcutsEnabled(): boolean {
  return localStorage.getItem(SHORTCUT_ENABLED_STORAGE_KEY) !== "false";
}

const CheatMenu: React.FC<GameProps> = ({ gameInfo, session }) => {
  const [activeKey, setActiveKey] = useState(session.databaseReadOnly?"runtime":"1");
  const [collectionGroups,setCollectionGroups]=useState<GameCollection[]>([]);
  const [collectionError,setCollectionError]=useState("");
  const [collectionRefresh,setCollectionRefresh]=useState(0);
  const [collectionInitialization,setCollectionInitialization]=useState<{sessionId?:string;state:"loading"|"ready"|"failed"}>({state:"loading"});
  const gameReady = session.state === "ready" || !!session.databaseReadOnly;
  const wolfCollectionInitializing =
    session.game?.engine === "wolf" &&
    !!session.databaseReadOnly &&
    (collectionInitialization.sessionId !== session.sessionId ||
      collectionInitialization.state === "loading");
  const [shortcutBindings, setShortcutBindings] =
    useState<ShortcutBindings>(loadShortcutBindings);
  const [shortcutRegistrationResults, setShortcutRegistrationResults] =
    useState<ShortcutRegistrationResults>({});
  const [shortcutsEnabled, setShortcutsEnabled] =
    useState(loadShortcutsEnabled);
  const runningShortcutActions = useRef(new Set<GameShortcutActionId>());
  const [api, contextHolder] = notification.useNotification();
  const {
    database,
    collections,
    setRuntimeGold,
    features,
    capabilities,
    refreshFeature,
    modifyGold,
    modifyVariable,
    modifySwitch,
    gainItem,
    setInTeam,
    setActorData,
    sendTranslationData,
    achieveVictory,
    achieveDefeat,
    escapeBattle,
    setSomeGameSettings,
    shortcutActions,
    shortcutPolicy,
    executeShortcutAction,
  } = useGameFeatures(gameInfo.engine, session.sessionId, session.capabilities);

  useEffect(()=>{
    if(!collections||!session.databaseReadOnly)return;
    let active=true;
    let timer:ReturnType<typeof setTimeout>;
    setCollectionGroups([]);setCollectionError("");
    setCollectionInitialization({sessionId:session.sessionId,state:"loading"});
    const load=async()=>{
      try{
        const groups=await collections.list();
        if(active){
          setCollectionGroups(groups);setCollectionError("");
          setCollectionInitialization({sessionId:session.sessionId,state:"ready"});
          void window.electronAPI.refreshGameTelemetry(session.sessionId);
        }
      }catch(error){
        if(!active)return;
        if(isDatabaseStartingError(error)){
          timer=setTimeout(load,500);
        } else {
          setCollectionError(String(error instanceof Error?error.message:error));
          setCollectionInitialization({sessionId:session.sessionId,state:"failed"});
        }
      }
    };
    void load();
    return()=>{active=false;clearTimeout(timer);};
  },[collections,session.databaseReadOnly,session.sessionId]);

  const getFeatureDataWithNotify = useCallback(async (
    feature: GameFeatureKey,
  ) => {
    if (!gameReady) return;

    const notifyKey = `get-game-data-${feature}`;
    api.open({
      key: notifyKey,
      message: "正在获取游戏数据",
      icon: <LoadingOutlined style={{ color: "#1890ff" }} spin />,
      duration: 0,
    });

    try {
      await refreshFeature(feature);
      api.destroy(notifyKey);
    } catch (error: any) {
      api.destroy(notifyKey);
      api.error({
        key: `${notifyKey}-error`,
        message: "数据更新失败",
        description: error?.message || "未知错误",
        icon: <CloseCircleOutlined style={{ color: "#ff4d4f" }} />,
      });
      throw error;
    }
  }, [api, gameReady, refreshFeature]);

  const refreshActiveFeature = useCallback(() => {
    const feature = getTabFeatureKey(activeKey);
    if (feature) void getFeatureDataWithNotify(feature).catch(()=>{});
    if(activeKey.startsWith("collection:"))setCollectionRefresh(current=>current+1);
    if(session.databaseReadOnly&&session.sessionId)void window.electronAPI.refreshGameTelemetry(session.sessionId);
  }, [activeKey, getFeatureDataWithNotify, session.databaseReadOnly, session.sessionId]);

  useEffect(() => {
    if (!gameReady) return;

    window.addEventListener("focus", refreshActiveFeature);
    return () => {
      window.removeEventListener("focus", refreshActiveFeature);
    };
  }, [gameReady, refreshActiveFeature]);

  useEffect(() => {
    refreshActiveFeature();
  }, [gameReady, activeKey, refreshActiveFeature]);

  useEffect(() => {
    localStorage.setItem(
      SHORTCUT_STORAGE_KEY,
      JSON.stringify(shortcutBindings),
    );
    localStorage.setItem(
      SHORTCUT_ENABLED_STORAGE_KEY,
      String(shortcutsEnabled),
    );

    const supportedActionIds = new Set(shortcutActions.map(({ id }) => id));
    const configuredBindings = Object.entries(shortcutBindings)
      .filter(
        (entry): entry is [GameShortcutActionId, string] =>
          supportedActionIds.has(entry[0] as GameShortcutActionId) &&
          typeof entry[1] === "string" &&
          entry[1].length > 0,
      );
    const blockedResults: ShortcutRegistrationResults = {};
    const activeBindings = shortcutsEnabled
      ? configuredBindings.flatMap(([actionId, accelerator]) => {
          const reason = getShortcutRestrictionReason(
            shortcutPolicy,
            accelerator,
          );
          if (reason) {
            blockedResults[actionId] = false;
            return [];
          }
          return [{ actionId, accelerator }];
        })
      : [];

    window.electronAPI
      .updateGlobalShortcuts(activeBindings)
      .then((results) => {
        const nextResults = shortcutsEnabled
          ? { ...blockedResults, ...results }
          : {};
        setShortcutRegistrationResults(
          nextResults as ShortcutRegistrationResults,
        );

        const failedActions = shortcutActions.filter(
          ({ id }) => nextResults[id] === false,
        );
        if (failedActions.length > 0) {
          api.warning({
            message: "部分快捷键未能启用",
            description: `${failedActions.map(({ name }) => name).join("、")}：可能是引擎保留键，或已被系统、游戏和其他软件占用。`,
            duration: 5,
          });
        }
      })
      .catch(() => {
        setShortcutRegistrationResults({});
        if (shortcutsEnabled) {
          api.error({
            message: "快捷键注册失败",
            description: "无法更新全局快捷键，请重新设置或重启工具。",
          });
        }
      });
  }, [api, shortcutActions, shortcutBindings, shortcutPolicy, shortcutsEnabled]);

  useEffect(() => {
    return window.electronAPI.onReceiveMessage(
      "shortcut-triggered",
      async (_event, actionId: GameShortcutActionId) => {
        if (!shortcutsEnabled) return;
        const action = shortcutActions.find(({ id }) => id === actionId);
        if (!action || runningShortcutActions.current.has(actionId)) return;

        if (!gameReady) {
          api.warning({
            message: "游戏尚未就绪",
            description: `无法执行“${action.name}”`,
          });
          return;
        }

        runningShortcutActions.current.add(actionId);
        try {
          await executeShortcutAction(actionId);
          api.success({ message: `${action.name}已执行`, duration: 1.5 });
        } catch (error) {
          api.error({
            message: `${action.name}执行失败`,
            description:
              error instanceof Error ? error.message : "未知错误",
          });
        } finally {
          runningShortcutActions.current.delete(actionId);
        }
      },
    );
  }, [
    api,
    executeShortcutAction,
    gameReady,
    shortcutActions,
    shortcutsEnabled,
  ]);

  const setShortcutBinding = useCallback(
    (actionId: GameShortcutActionId, accelerator: string | null) => {
      setShortcutBindings((current) => {
        const next = { ...current };
        if (accelerator) next[actionId] = accelerator;
        else delete next[actionId];
        return next;
      });
    },
    [],
  );

  const menuList = createCheatMenuTabs(capabilities, {
    runtime:database&&session.databaseReadOnly?<RuntimeConsole session={session} access={database} onWrite={setRuntimeGold} />:undefined,
    collections:collections?collectionGroups.map(group=>({key:`collection:${group.key}`,label:group.label,
      children:<CollectionBrowser access={collections} group={group} active={activeKey===`collection:${group.key}`} writeEnabled={!!session.inventoryWritable} refreshToken={collectionRefresh} />})):undefined,
    database:database&&DatabaseBrowser?<React.Suspense fallback={null}><div className="runtime-page"><DatabaseBrowser access={database} /></div></React.Suspense>:undefined,
    gameInfo,
    modifyGold,
    modifyVariable,
    modifySwitch,
    gainItem,
    setInTeam,
    setActorData,
    sendTranslationData,
    achieveVictory,
    achieveDefeat,
    escapeBattle,
    setSomeGameSettings,
    shortcutActions,
    shortcutBindings,
    shortcutRegistrationResults,
    shortcutsEnabled,
    shortcutPolicy,
    setShortcutsEnabled,
    setShortcutBinding,
  });

  return (
    <div className="cheat-menu">
      {contextHolder}
      {collectionError&&<div className="wolf-collection-error">物品识别失败：{collectionError}（重新连接游戏后重试）</div>}
      <LoadingOverlay
        visible={!gameReady || wolfCollectionInitializing}
        text={session.game?.engine === "wolf" ? "正在初始化游戏数据库与物品资料…" : "游戏初始化中…"}
      />
      <GameFeatureProvider
        features={features}
        refresh={getFeatureDataWithNotify}
      >
        <Tabs
          className="cheat-menu-tabs"
          activeKey={activeKey}
          items={menuList}
          onChange={setActiveKey}
          type="card"
        />
      </GameFeatureProvider>
    </div>
  );
};

export default CheatMenu;
