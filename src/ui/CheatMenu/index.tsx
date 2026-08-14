import React, { useCallback, useEffect, useState } from "react";
import { notification, Tabs } from "antd";
import { CloseCircleOutlined, LoadingOutlined } from "@ant-design/icons";
import LoadingOverlay from "@/components/LoadingOverlay";
import { useGameData } from "@/game/useGameData";
import { createCheatMenuTabs } from "./tabRegistry";
import "./index.css";

interface GameProps {
  isGameStarting: boolean;
  gameInfo: any;
}

const CheatMenu: React.FC<GameProps> = ({ isGameStarting, gameInfo }) => {
  const [activeKey, setActiveKey] = useState("1");
  const [gameReady, setGameReady] = useState(false);
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
    setSomeGameSettings,
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
    setSomeGameSettings,
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
