import React, { useState, useEffect } from "react";
import { InputNumber, Button, Switch, Tooltip, Space } from "antd";
import type { GameData } from "@/types/Game";
import "./index.css";

interface Props {
  rpgGameData: GameData | null;
  getGameData: () => void;
  handleAchieveVictory: () => void;
  modifyGold: (amount: number) => void;
  setSomeGameSettings: (type: string, value: any) => Promise<void>;
}

const Home: React.FC<Props> = ({
  rpgGameData,
  getGameData,
  handleAchieveVictory,
  modifyGold,
  setSomeGameSettings,
}) => {
  const [data, setData] = useState(rpgGameData);

  useEffect(() => {
    setData(rpgGameData);
  }, [rpgGameData]);

  return (
    <div>
      <div>
        <Space>
          <InputNumber
            className="general-input"
            addonBefore="Gold"
            min={0}
            precision={0}
            stringMode={false}
            step={1}
            value={data?.gold || 0}
            onChange={(value: number | null) => {
              if (value)
                setData((prev) => (prev ? { ...prev, gold: value } : prev));
            }}
            onBlur={(e) => {
              if (Number(e.target.value)) {
                modifyGold(Number(e.target.value));
              }
            }}
          />
          <InputNumber
            className="general-input"
            addonBefore="移动速度"
            min={0}
            precision={0}
            stringMode={false}
            step={1}
            value={data?.playerSpeed || 0}
            onChange={(value: number | null) => {
              if (value)
                setData((prev) =>
                  prev ? { ...prev, playerSpeed: value } : prev
                );
            }}
            onBlur={(e) => {
              if (Number(e.target.value)) {
                setSomeGameSettings("playerSpeed", Number(e.target.value));
              }
            }}
          />
        </Space>
      </div>
      <div>
        <Space>
          <Tooltip title="决定你是否会在野外遇到敌人,部分游戏并不会起效.">
            <span>遇敌</span>
            <Switch
              checkedChildren="开"
              unCheckedChildren="关"
              checked={data?.isEncounterEnabled}
              onChange={(checked) => {
                setSomeGameSettings("isEncounterEnabled", checked);
              }}
            />
          </Tooltip>
          <Tooltip title="部分游戏没有人物队伍的展示,所以最好不要用这个功能">
            <span>整队</span>
            <Switch
              checkedChildren="开"
              unCheckedChildren="关"
              checked={data?.isFormationEnabled}
              onChange={(checked) => {
                setSomeGameSettings("isFormationEnabled", checked);
              }}
            />
          </Tooltip>
          <Tooltip title="">
            <span>穿墙</span>
            <Switch
              checkedChildren="开"
              unCheckedChildren="关"
              checked={data?.through}
              onChange={(checked) => {
                setSomeGameSettings("through", checked);
              }}
            />
          </Tooltip>
          <Tooltip title="需处于战斗状态">
            <Button onClick={handleAchieveVictory}>战斗取得胜利</Button>
          </Tooltip>
          <Tooltip title="如果你发现工具里的游戏数据与游戏中对不上可以尝试点击此按钮手动刷新数据">
            <Button onClick={getGameData}>手动获取数据</Button>
          </Tooltip>
        </Space>
      </div>
    </div>
  );
};

export default Home;
