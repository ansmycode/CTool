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
    shortcutActions: [
      {
        id: "toggleThrough",
        name: "切换穿墙模式",
        description: "在开启与关闭地图碰撞之间切换",
        category: "开关",
        supportedEngines: ["MV", "MZ"],
      },
      {
        id: "achieveVictory",
        name: "战斗直接胜利",
        description: "在战斗中立即执行胜利结算",
        category: "触发",
        supportedEngines: ["MV", "MZ"],
      },
    ],
    shortcutBindings: { toggleThrough: "F6" },
    shortcutRegistrationResults: { toggleThrough: true },
    setShortcutBinding: () => {},
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
