// App.tsx
import React, { lazy, Suspense, useEffect, useState } from "react";
import { Layout, Button, message, Spin, Tabs, Alert } from "antd";
import type { DetectedGame, GameSessionSnapshot } from "@/types/GameSession";
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
  const [gameInfo, setGameInfo] = useState<DetectedGame | null>(null);
  const [session, setSession] = useState<GameSessionSnapshot | null>(null);
  const [launchBusy, setLaunchBusy] = useState(false);
  const [activeKey, setActiveKey] = useState("1");
  const isGameStarting = session?.processState === "running" ||
    (session?.state === "launching" && !["failed", "closed"].includes(session.state));

  const applySession = (next: GameSessionSnapshot | null) => {
    if (next) setSession((current) => !current || next.revision > current.revision ? next : current);
  };
  const chooseGame = async () => {
    try {
      const file = await window.electronAPI.chooseGame();
      if (file) setGameInfo(await window.electronAPI.detectEngine(file));
    } catch (error) { message.error(error instanceof Error ? error.message : "识别失败"); }
  };
  const handleLaunchGame = async (info: { gamePath: string }) => {
    if (launchBusy) return;
    setLaunchBusy(true);
    try { applySession(await window.electronAPI.launchGame(info.gamePath)); }
    catch (error) { message.error(error instanceof Error ? error.message : "启动失败"); }
    finally { setLaunchBusy(false); }
  };
  const historyLaunchGame = (info: { gamePath: string }) => { void handleLaunchGame(info); };

  const openFakeGamePreview = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("preview", "fake-game");
    window.location.href = url.toString();
  };

  useEffect(() => {
    if (!window.electronAPI?.onGameSessionChanged) return;
    let mounted = true;
    const off = window.electronAPI.onGameSessionChanged((next) => { if (mounted) applySession(next); });
    void window.electronAPI.getGameSession()
      .then((next) => { if (mounted) applySession(next); })
      .catch(() => { if (mounted) message.error("无法获取游戏会话状态"); });
    return () => { mounted = false; off(); };
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
              <p>选择 RPG Maker MV / MZ 或已适配的 Wolf 游戏启动文件。</p>
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
          {gameInfo?.gamePath && (
            <section className="tool-gameinfo">
              <div className="gameinfo-title">
                <strong>游戏识别结果</strong>
                <span>{gameInfo?.supported ? "可以启动" : "暂不支持"}</span>
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
              {gameInfo.supportMessage && <p>{gameInfo.supportMessage}</p>}
              <div className="gameinfo-actions">
                {gameInfo?.supported ? (
                  <Button
                  type="primary"
                  onClick={() => handleLaunchGame(gameInfo)}
                  disabled={!gameInfo?.supported || launchBusy}
                  loading={launchBusy}
                  >
                    启动游戏并连接
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
        {session?.state === "failed" && !isGameStarting && <Alert type="error" showIcon message={session.message} />}
        <Suspense fallback={pageFallback}>
          {isGameStarting ? (
            session?.game ? (
              <CheatMenu key={session.sessionId} isGameStarting={true} gameInfo={session.game} session={session} />
            ) : (
              <section className="launch-page">
                <h2>{session?.game?.title || "游戏会话"}</h2>
                <Alert type={session?.state === "failed" ? "error" : "info"}
                  showIcon message={session?.message || "正在启动"}
                  description={session?.state === "degraded"
                    ? "数据库按需只读访问；金币按基本系统规则识别，也可手动绑定数字字段。修改和翻译尚未开放。"
                    : "请等待游戏初始化；游戏退出后会返回启动页。"} />
                <p>PID：{session?.pid ?? "—"} · 引擎：{session?.game?.engine ?? "—"} · 版本：{session?.game?.version ?? "—"}</p>
              </section>
            )
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
