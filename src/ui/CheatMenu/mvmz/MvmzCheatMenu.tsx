import React, { useCallback, useEffect, useState } from "react";
import { notification, Tabs } from "antd";
import { CloseCircleOutlined, LoadingOutlined } from "@ant-design/icons";
import LoadingOverlay from "@/components/LoadingOverlay";
import { GameFeatureProvider } from "@/game/GameFeatureContext";
import { useGameFeatures } from "@/game/useGameFeatures";
import useGameShortcuts from "../shared/shortcuts/useGameShortcuts";
import { createCheatMenuTabs, getTabFeatureKey } from "./tabRegistry";
import type { GameFeatureKey } from "@/game/features";


import "../index.css";
import type { GameSessionSnapshot } from "@/types/GameSession";

interface GameProps {
  session: GameSessionSnapshot;
  isGameStarting: boolean;
  gameInfo: any;
}

const MvmzCheatMenu: React.FC<GameProps> = ({ gameInfo, session }) => {
  const [activeKey, setActiveKey] = useState("1");
  const gameReady = session.state === "ready";
  const [api, contextHolder] = notification.useNotification();
  const {
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
  }, [activeKey, getFeatureDataWithNotify]);

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

  const { bindings: shortcutBindings, registrationResults: shortcutRegistrationResults,
    enabled: shortcutsEnabled, setEnabled: setShortcutsEnabled, setBinding: setShortcutBinding,
    contextHolder: shortcutContextHolder } = useGameShortcuts({
      engine: 'mvmz', sessionId: session.sessionId, ready: gameReady,
      actions: shortcutActions, policy: shortcutPolicy, execute: executeShortcutAction,
    });
  const menuList = createCheatMenuTabs(capabilities, {
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
      {contextHolder}{shortcutContextHolder}
      <LoadingOverlay visible={!gameReady} />
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

export default MvmzCheatMenu;
