// App.tsx
import React, { lazy, Suspense, useEffect, useState } from "react";
import { Layout, Button, message, Spin, Tabs } from "antd";
import { InboxOutlined } from "@ant-design/icons";
const { Content, Footer } = Layout;

import "./index.css";

const CheatMenu = lazy(() => import("../CheatMenu/index"));
const GameHistory = lazy(() => import("@/ui/GameHistory"));
const AuthorInfo = lazy(() => import("@/ui/AuthorInfo"));

const pageFallback = (
  <div className="page-loading">
    <Spin size="large" />
  </div>
);

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

  const openFakeGamePreview = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("preview", "fake-game");
    window.location.href = url.toString();
  };

  useEffect(() => {
    return window.electronAPI.onReceiveMessage(
      "game-closed",
      (_: unknown, result: any) => {
        setIsGameStarting(result.isGameStarting);
        setGameInfo({});
      },
    );
  }, []);

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
          {import.meta.env.DEV && (
            <div style={{ marginTop: 16, textAlign: "center" }}>
              <Button onClick={openFakeGamePreview}>进入假游戏（DEV）</Button>
            </div>
          )}
          {gameInfo.gamePath && (
            <div className="tool-gameinfo" >
              <p>已检测路径: {gameInfo.gamePath}</p>
              <p>游戏引擎: {gameInfo?.engine || "未知"}</p>
              <p>游戏版本: {gameInfo?.version || "未知"}</p>
              {
                gameInfo?.engine ? <Button
                  type="primary"
                  onClick={() => handleLaunchGame(gameInfo)}
                  disabled={!gameInfo?.engine}
                >
                  启动游戏并注入脚本
                </Button> : <span style={{ color: "#999" }}>不支持或未知引擎</span>
              }

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
        <Suspense fallback={pageFallback}>
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
        </Suspense>
      </Content>
      {!isGameStarting && (
        <Footer className="layout-footer" style={{ textAlign: "center" }}>
          CTool v0.0.1
        </Footer>
      )}
    </Layout>
  );
};

export default Main;
