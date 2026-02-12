// App.tsx
import React, { useState } from "react";
import { Layout, Button, message, Tabs } from "antd";
import { InboxOutlined } from "@ant-design/icons";
const { Content, Footer } = Layout;
import CheatMenu from "../CheatMenu/index";
import GameHistory from "@/ui/GameHistory";
import AuthorInfo from '@/ui/AuthorInfo';

import "./index.css";

const Main: React.FC = () => {
  const [gameInfo, setGameInfo] = useState<any>({});
  const [isGameStarting, setIsGameStarting] = useState<boolean>(false);
  const [activeKey, setActiveKey] = useState("1");

  const chooseGame = async () => {
    const _gamePath = await (window as any).electronAPI.chooseGame();
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
      setIsGameStarting(result.isGameStarting);
      setGameInfo({});
    }
  );

  const tabsItems = [
    {
      key: "1",
      label: "游戏启动",
      children: (
        <div style={{ padding: 16 }}>
          <div onClick={chooseGame} className="drop-zone">
            <InboxOutlined style={{ fontSize: 48, color: "#1890ff" }} />
            <p style={{ marginTop: 16 }}>
              点击选择 <strong>游戏启动文件Game.exe</strong>
            </p>
          </div>
          {gameInfo.gamePath && (
            <div className="tool-gameinfo" >
              <p>已检测路径: {gameInfo.gamePath}</p>
              <p>游戏引擎: {gameInfo?.engine || "未知"}</p>
              <p>游戏版本: {gameInfo?.version || "未知"}</p>
              <Button
                type="primary"
                onClick={() => handleLaunchGame(gameInfo)}
                disabled={!gameInfo?.engine}
              >
                启动游戏并注入脚本
              </Button>
            </div>
          )}
        </div>
      ),
      className: "tool-tabPane"
    },
    {
      key: "2",
      label: "游玩历史",
      children: (
        <GameHistory historyLaunchGame={historyLaunchGame} />
      ),
      className: "tool-tabPane"
    },
    {
      key: "3",
      label: "作者的话",
      children: <AuthorInfo />,
      className: "tool-tabPane"
    },
  ];

  return (
    <Layout
      className="app-layout"
    >
      <Content
        className="tool-content"
      >
        {isGameStarting ? (
          <CheatMenu isGameStarting={isGameStarting} gameInfo={gameInfo} />
        ) : (
          <Tabs
            className="tool-tabs"
            activeKey={activeKey}
            onChange={setActiveKey}
            items={tabsItems}
            type="card"
          />
        )}
      </Content>
      <Footer className="layout-footer" style={{ textAlign: "center" }}>
        CTool v0.0.1
      </Footer>
    </Layout>
  );
};

export default Main;
