// App.tsx
import React, { useState } from 'react';
import { Layout, Typography, Button, Divider, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
const { Header, Content, Footer } = Layout;
const { Title } = Typography;
import CheatMenu from "../CheatMenu/index";
import "./index.css";


const Main: React.FC = () => {
  const [gamePath, setGamePath] = useState<string | null>(null);
  const [gameEngine, setGameEngine] = useState<{ engine: string, version: string }>({ engine: '', version: '' });
  const [isGameStarting, setIsGameStarting] = useState<any>(false);


  const chooseGame = async () => {
    //获取游戏路径
    const _gamePath = await (window as any).electronAPI.chooseGame();
    console.log(_gamePath)
    setGamePath(_gamePath)
    const _gameEngine = await (window as any).electronAPI.detectEngine(_gamePath);
    setGameEngine(_gameEngine)
  }

  const handleLaunchGame = async () => {
    if (gameEngine.engine === "MV" || gameEngine.engine === "MZ") {
      const result = await (window as any).electronAPI.injectScript(gamePath);
      setIsGameStarting(result)
    } else {
      message.warning("暂时只支持rpgMaker MV/MZ引擎的游戏")
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ color: '#fff' }}>RPG调试器</Header>
      {
        isGameStarting ? <Content style={{ padding: '2rem' }}>
          <CheatMenu isGameStarting={isGameStarting} />
          <Divider />
        </Content> : <Content style={{ padding: '2rem' }}>
          <Title level={4}>选择游戏与启动</Title>
          <div
            onClick={chooseGame}
            className="drop-zone"
            style={{
              border: '2px dashed #ccc',
              borderRadius: '8px',
              padding: '40px',
              textAlign: 'center',
              cursor: 'pointer',
            }}
          >
            <InboxOutlined style={{ fontSize: 48, color: '#1890ff' }} />
            <p style={{ marginTop: 16 }}>请拖拽 <strong>Game.exe</strong> 到此区域</p>
          </div>
          {gamePath && (
            <>
              <p>已检测路径: {gamePath}</p>
              <p>游戏引擎: {gameEngine?.engine || "未知"}</p>
              <p>游戏版本: {gameEngine?.version || "未知"}</p>
              <Button type="primary" onClick={handleLaunchGame}>
                启动游戏并注入脚本
              </Button>
            </>
          )}
          <Divider />
        </Content>
      }

      <Footer style={{ textAlign: 'center' }}>CTool RPG游戏修改器 1.0.0</Footer>
    </Layout>
  );
};

export default Main;
