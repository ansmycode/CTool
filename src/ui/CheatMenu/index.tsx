import React, { useState, useEffect } from "react";
import { Tabs, notification } from "antd";
import ArmorTable from "./armorTable/index";
import Home from "./home/index";
import WeaponTable from "./weaponTable/index";
import SwitchesTable from "./switchesTable/index";
import VariablesTable from "./variablesTable/index";
import ItemsTable from "./itemsTable/index";
import ActorTable from "./actorTable/index";
import TranslateTool from "./translateTool/index";
import { useGameData } from "@/components/useGameData";
import type { TabsProps } from "antd";
import { LoadingOutlined, CloseCircleOutlined } from "@ant-design/icons";
import LoadingOverlay from '@/components/LoadingOverlay';
import "./index.css";

interface GameProps {
  isGameStarting: boolean;
  gameInfo: any;
}

const CheatMenu: React.FC<GameProps> = ({ isGameStarting, gameInfo }) => {
  const [activeKey, setActiveKey] = useState("1");
  const [gameReady, setGameReady] = useState(false);
  const [api, contextHolder] = notification.useNotification();
  // const [messageApi, messageContext] = message.useMessage();
  const {
    gameData,
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

  useEffect(() => {
    window.addEventListener("focus", getGameDataWithNotify);
    return () => {
      window.removeEventListener("focus", getGameDataWithNotify);
    };
  }, []);

  window.electronAPI.onReceiveMessage(
    "game-ready",
    (_: any, result: any) => {
    setGameReady(result)
    }
  );

  const getGameDataWithNotify = async () => {
    const notifyKey = "get-game-data";

    // 打开加载中提示
    api.open({
      key: notifyKey,
      message: "正在获取游戏数据",
      icon: <LoadingOutlined style={{ color: "#1890ff" }} spin />,
      duration: 0,
    });

    try {
      await getGameData();
      // 成功 → 关闭加载提示
      api.destroy(notifyKey);
    } catch (err: any) {
      // 关闭加载提示
      api.destroy(notifyKey);
      // 显示错误提示
      api.error({
        key: `${notifyKey}-error`,
        message: "数据更新失败",
        description: err?.message || "未知错误",
        icon: <CloseCircleOutlined style={{ color: "#ff4d4f" }} />,
      });

      throw err;
    }
  };

  const menuList: TabsProps["items"] = [
    {
      key: "1",
      label: "主页",
      children: (
        <Home
          rpgGameData={gameData}
          getGameData={getGameDataWithNotify}
          handleAchieveVictory={achieveVictory}
          modifyGold={modifyGold}
          setSomeGameSettings={setSomeGameSettings}
        />
      ),
      className: 'tab-pane-fullheight', // ← 关键
    },
    {
      key: "2",
      label: "物品: 道具",
      children: (
        <ItemsTable ItemsData={gameData?.allItem} handleGainItem={gainItem} />
      ),
      className: 'tab-pane-fullheight', // ← 关键
    },
    {
      key: "3",
      label: "物品: 防具",
      children: (
        <ArmorTable
          ArmorsData={gameData?.allArmors}
          handleGainItem={gainItem}
        />
      ),
      className: 'tab-pane-fullheight', // ← 关键
    },
    {
      key: "4",
      label: "物品: 武器",
      children: (
        <WeaponTable
          WeaponsData={gameData?.allWeapons}
          handleGainItem={gainItem}
        />
      ),
      className: 'tab-pane-fullheight', // ← 关键
    },
    {
      key: "5",
      label: "变量",
      children: (
        <VariablesTable
          variables={gameData?.variables}
          changeVariables={modifyVariable}
        />
      ),
      className: 'tab-pane-fullheight', // ← 关键
    },
    {
      key: "6",
      label: "开关",
      children: (
        <SwitchesTable
          switches={gameData?.switches}
          changeSwitches={modifySwitch}
        />
      ),
      className: 'tab-pane-fullheight', // ← 关键
    },
    {
      key: "7",
      label: "角色",
      children: (
        <ActorTable
          actorData={gameData?.allMembers ?? []}
          classData={gameData?.classList ?? []}
          setActorInTeam={setInTeam}
          setActorData={setActorData}
        />
      ),
      className: 'tab-pane-fullheight', // ← 关键
    },
    {
      key: "8",
      label: "翻译",
      children: (
        <TranslateTool
          gameInfo={gameInfo}
          sendTranslationData={sendTranslationData}
        />
      ),
      className: 'tab-pane-fullheight', // ← 关键
    },
  ];

  const TabsChange = (key: string) => {
    setActiveKey(key);
  };

  return (
    <div className="cheat-menu">
      {contextHolder}
      {/* {messageContext} */}
      <LoadingOverlay visible={!gameReady} />
      <Tabs
        className="cheat-menu-tabs"
        activeKey={activeKey}
        items={menuList}
        onChange={TabsChange}
        type="card"
      />
    </div>
  );
};

export default CheatMenu;
