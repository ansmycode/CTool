// App.tsx
import React, { useState } from "react";
import { Layout, Button, Divider, message, Tabs } from "antd";
import { InboxOutlined } from "@ant-design/icons";
const { Content, Footer } = Layout;
import CheatMenu from "../CheatMenu/index";
import type { TabsProps } from "antd";
import GameHistory from "@/ui/GameHistory";

// import { GameDataProvider } from "../../components/GameDataContext";

import "./index.css";

const Main: React.FC = () => {
  // const [gamePath, setGamePath] = useState<string | null>(null);
  const [gameInfo, setGameInfo] = useState<any>({});
  const [isGameStarting, setIsGameStarting] = useState<any>(false);
  const [activeKey, setActiveKey] = useState("1");

  const TabsChange = (key: string) => {
    setActiveKey(key);
  };

  const chooseGame = async () => {
    //获取游戏路径
    const _gamePath = await (window as any).electronAPI.chooseGame();
    // console.log(_gamePath);
    // setGamePath(_gamePath);
    const _gameInfo = await (window as any).electronAPI.detectEngine(_gamePath);
    setGameInfo(_gameInfo);
  };

  const handleLaunchGame = async (info: any) => {
    if (info.engine === "MV" || info.engine === "MZ") {
      const result = await (window as any).electronAPI.injectScript(info);
      setIsGameStarting(result);
    } else {
      message.warning("暂时只支持RpgMaker MV/MZ引擎的游戏");
    }
  };

  const historyLaunchGame = (infoFromHistory: any) => {
    setGameInfo(infoFromHistory);
    handleLaunchGame(infoFromHistory);
  };

  (window as any).electronAPI.onReceiveMessage(
    "game-closed",
    (_: any, result: any) => {
      // console.log(result.meesage);
      setIsGameStarting(result.isGameStarting);
      setGameInfo({});
    }
  );

  const menuList: TabsProps["items"] = [
    {
      key: "1",
      label: <div className="tab-main">游戏启动</div>,
      children: (
        <div>
          <div onClick={chooseGame} className="drop-zone">
            <InboxOutlined style={{ fontSize: 48, color: "#1890ff" }} />
            <p style={{ marginTop: 16 }}>
              点击选择 <strong>游戏启动文件Game.exe</strong>
            </p>
          </div>
          {gameInfo.gamePath && (
            <>
              <p>已检测路径: {gameInfo.gamePath}</p>
              <p>游戏引擎: {gameInfo?.engine || "未知"}</p>
              <p>游戏版本: {gameInfo?.version || "未知"}</p>
              <Button
                type="primary"
                onClick={() => {
                  handleLaunchGame(gameInfo);
                }}
                disabled={gameInfo?.engine ? false : true}
              >
                启动游戏并注入脚本
              </Button>
            </>
          )}
        </div>
      ),
    },
    {
      key: "2",
      label: <div className="tab-normal">游玩历史</div>,
      children: <GameHistory historyLaunchGame={historyLaunchGame} />,
    },
    {
      key: "3",
      label: <div className="tab-normal">作者的话</div>,
      children: <div className="">作者的话</div>,
    },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {isGameStarting ? (
        <Content className="tool-cheatmenu">
          <CheatMenu isGameStarting={isGameStarting} gameInfo={gameInfo} />
          <Divider />
        </Content>
      ) : (
        <Content className="tool-main">
          <Tabs
            activeKey={activeKey}
            items={menuList}
            onChange={TabsChange}
            type="card"
          />
          <Divider />
        </Content>
      )}

      <Footer style={{ textAlign: "center" }}>CTool v1.0.0</Footer>
    </Layout>
  );
};

export default Main;
