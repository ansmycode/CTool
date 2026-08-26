import React, { useCallback, useEffect, useRef, useState } from "react";
import { notification, Tabs } from "antd";
import { CloseCircleOutlined, LoadingOutlined } from "@ant-design/icons";
import LoadingOverlay from "@/components/LoadingOverlay";
import { useGameData } from "@/game/useGameData";
import { getShortcutRestrictionReason } from "@/game/shortcutPolicy";
import { createCheatMenuTabs } from "./tabRegistry";
import type { GameShortcutActionId } from "@/game/types";
import type {
  ShortcutBindings,
  ShortcutRegistrationResults,
} from "./shortcuts/types";
import "./index.css";

interface GameProps {
  isGameStarting: boolean;
  gameInfo: any;
}

const SHORTCUT_STORAGE_KEY = "ctool:shortcut-bindings:v1";
const SHORTCUT_ENABLED_STORAGE_KEY = "ctool:shortcuts-enabled:v1";

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

const CheatMenu: React.FC<GameProps> = ({ isGameStarting, gameInfo }) => {
  const [activeKey, setActiveKey] = useState("1");
  const [gameReady, setGameReady] = useState(false);
  const [shortcutBindings, setShortcutBindings] =
    useState<ShortcutBindings>(loadShortcutBindings);
  const [shortcutRegistrationResults, setShortcutRegistrationResults] =
    useState<ShortcutRegistrationResults>({});
  const [shortcutsEnabled, setShortcutsEnabled] =
    useState(loadShortcutsEnabled);
  const runningShortcutActions = useRef(new Set<GameShortcutActionId>());
  const [api, contextHolder] = notification.useNotification();
  const {
    gameData,
    capabilities,
    getGameData,
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
  } = useGameData(gameInfo.engine);

  console.log("游戏启动" + isGameStarting);
  console.log("游戏初始化" + gameReady);

  const getGameDataWithNotify = useCallback(() => {
    if (!gameReady) return;

    const notifyKey = "get-game-data";
    api.open({
      key: notifyKey,
      message: "正在获取游戏数据",
      icon: <LoadingOutlined style={{ color: "#1890ff" }} spin />,
      duration: 0,
    });

    try {
      getGameData();
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
  }, [gameReady]);

  useEffect(() => {
    if (!gameReady) return;

    window.addEventListener("focus", getGameDataWithNotify);
    return () => {
      window.removeEventListener("focus", getGameDataWithNotify);
    };
  }, [getGameDataWithNotify]);

  useEffect(() => {
    return window.electronAPI.onReceiveMessage(
      "game-ready",
      (_: unknown, result: any) => {
        setGameReady(result);
      },
    );
  }, []);

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
    gameData,
    gameInfo,
    getGameData: getGameDataWithNotify,
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
      <LoadingOverlay visible={!gameReady} />
      <Tabs
        className="cheat-menu-tabs"
        activeKey={activeKey}
        items={menuList}
        onChange={setActiveKey}
        type="card"
      />
    </div>
  );
};

export default CheatMenu;
