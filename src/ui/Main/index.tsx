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
    if (!window.electronAPI?.onReceiveMessage) return;
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
        <div className="launch-page">
          <div className="launch-heading">
            <div>
              <h2>启动游戏</h2>
              <p>选择 RPG Maker MV / MZ 游戏的 Game.exe，识别完成后即可启动。</p>
            </div>
            {import.meta.env.DEV && (
              <Button size="small" onClick={openFakeGamePreview}>
                进入假游戏（DEV）
              </Button>
            )}
          </div>
          <p className="launch-connection-note">
            <strong>连接说明：</strong>
            部分游戏在标题画面即可完成连接，部分游戏需要进入新游戏或读取存档后的地图。
          </p>
          <div onClick={chooseGame} className="drop-zone">
            <InboxOutlined style={{ fontSize: 48, color: "#1890ff" }} />
            <p style={{ marginTop: 16 }}>
              点击选择 <strong>游戏启动文件Game.exe</strong>
            </p>
          </div>
          {gameInfo.gamePath && (
            <section className="tool-gameinfo">
              <div className="gameinfo-title">
                <strong>游戏识别结果</strong>
                <span>{gameInfo?.engine ? "可以启动" : "暂不支持"}</span>
              </div>
              <div className="gameinfo-details">
                <span className="gameinfo-label">启动文件</span>
                <span className="gameinfo-path" title={gameInfo.gamePath}>
                  {gameInfo.gamePath}
                </span>
                <span className="gameinfo-label">游戏引擎</span>
                <span>{gameInfo?.engine || "未知"}</span>
                <span className="gameinfo-label">引擎版本</span>
                <span>{gameInfo?.version || "未知"}</span>
              </div>
              <div className="gameinfo-actions">
                {gameInfo?.engine ? (
                  <Button
                  type="primary"
                  onClick={() => handleLaunchGame(gameInfo)}
                  disabled={!gameInfo?.engine}
                  >
                    启动游戏并注入脚本
                  </Button>
                ) : (
                  <span className="gameinfo-unsupported">不支持或未知引擎</span>
                )}
              </div>
            </section>
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
          CTool
        </Footer>
      )}
    </Layout>
  );
};

export default Main;
