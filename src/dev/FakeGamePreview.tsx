import { useState } from "react";
import { Layout, Tabs } from "antd";
import type { GameCapability } from "@/game/types";
import { createCheatMenuTabs } from "@/ui/CheatMenu/tabRegistry";
import { fakeGameData } from "./fakeGameData";
import "@/ui/CheatMenu/index.css";
import "@/ui/Main/index.css";

const { Content } = Layout;

const allCapabilities = new Set<GameCapability>([
  "gold",
  "items",
  "armors",
  "weapons",
  "variables",
  "switches",
  "actors",
  "translation",
]);

const doNothing = async () => {};

/** 不连接游戏，仅为开发 UI 提供一份固定数据。 */
export default function FakeGamePreview() {
  const [activeKey, setActiveKey] = useState("1");
  const items = createCheatMenuTabs(allCapabilities, {
    gameData: fakeGameData,
    gameInfo: {
      engine: "MZ",
      version: "开发预览",
      gamePath: "D:\\FakeGame\\Game.exe",
    },
    getGameData: doNothing,
    modifyGold: doNothing,
    modifyVariable: doNothing,
    modifySwitch: doNothing,
    gainItem: doNothing,
    setInTeam: doNothing,
    setActorData: doNothing,
    sendTranslationData: doNothing,
    achieveVictory: doNothing,
    achieveDefeat: doNothing,
    escapeBattle: doNothing,
    setSomeGameSettings: doNothing,
  });

  return (
    <Layout className="app-layout">
      <Content className="tool-content">
        <div className="cheat-menu">
          <Tabs
            className="cheat-menu-tabs"
            activeKey={activeKey}
            items={items}
            onChange={setActiveKey}
            type="card"
          />
        </div>
      </Content>
    </Layout>
  );
}
