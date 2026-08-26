import React, { useEffect, useState } from "react";
import { Button, InputNumber, Switch, Tooltip, Typography } from "antd";
import type { GameData } from "@/game/types";
import "./index.css";

interface Props {
  rpgGameData: GameData | null;
  getGameData: () => void;
  handleAchieveVictory: () => void;
  handleAchieveDefeat: () => void;
  handleEscapeBattle: () => void;
  modifyGold: (amount: number) => void;
  setSomeGameSettings: (type: string, value: unknown) => Promise<void>;
}

interface SettingSwitchProps {
  title: string;
  description: string;
  checked?: boolean;
  tooltip?: string;
  onChange: (checked: boolean) => void;
}

const SettingSwitch: React.FC<SettingSwitchProps> = ({
  title,
  description,
  checked,
  tooltip,
  onChange,
}) => {
  const content = (
    <div className="home-setting-row">
      <span className="home-setting-copy">
        <Typography.Text strong>{title}</Typography.Text>
        <Typography.Text type="secondary">{description}</Typography.Text>
      </span>
      <Switch
        size="small"
        checkedChildren="开"
        unCheckedChildren="关"
        checked={checked}
        onChange={onChange}
      />
    </div>
  );

  return tooltip ? <Tooltip title={tooltip}>{content}</Tooltip> : content;
};

const Home: React.FC<Props> = ({
  rpgGameData,
  getGameData,
  handleAchieveVictory,
  handleAchieveDefeat,
  modifyGold,
  setSomeGameSettings,
}) => {
  const [data, setData] = useState(rpgGameData);

  useEffect(() => {
    setData(rpgGameData);
  }, [rpgGameData]);

  return (
    <div className="home-page">
      <header className="tool-page-header">
        <div>
          <Typography.Title level={3}>游戏控制台</Typography.Title>
          <Typography.Text type="secondary">
            调整常用游戏数据与运行设置
          </Typography.Text>
        </div>
        <Button size="small" onClick={getGameData}>
          刷新游戏数据
        </Button>
      </header>

      <section className="home-section">
        <div className="tool-section-heading">
          <div>
            <Typography.Title level={4}>常用数据</Typography.Title>
            <Typography.Text type="secondary">修改后离开输入框即可应用</Typography.Text>
          </div>
        </div>
        <div className="home-value-grid">
          <div className="home-value-card">
            <div className="home-value-content">
              <Typography.Text>持有金币</Typography.Text>
              <InputNumber
                className="home-value-input"
                min={0}
                precision={0}
                stringMode={false}
                step={1}
                value={data?.gold || 0}
                onChange={(value: number | null) => {
                  if (value !== null) {
                    setData((prev) => (prev ? { ...prev, gold: value } : prev));
                  }
                }}
                onBlur={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value)) modifyGold(value);
                }}
              />
            </div>
          </div>

          <div className="home-value-card">
            <div className="home-value-content">
              <Typography.Text>移动速度</Typography.Text>
              <InputNumber
                className="home-value-input"
                min={0}
                precision={0}
                stringMode={false}
                step={1}
                value={data?.playerSpeed || 0}
                onChange={(value: number | null) => {
                  if (value !== null) {
                    setData((prev) =>
                      prev ? { ...prev, playerSpeed: value } : prev,
                    );
                  }
                }}
                onBlur={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value)) {
                    setSomeGameSettings("playerSpeed", value);
                  }
                }}
              />
            </div>
          </div>

          <div className="home-value-card">
            <div className="home-value-content">
              <Tooltip title="不要调的太高!">
                <Typography.Text>游戏倍率</Typography.Text>
              </Tooltip>
              <InputNumber
                className="home-value-input"
                min={0.1}
                max={10}
                precision={1}
                stringMode={false}
                step={0.5}
                addonAfter="×"
                value={data?.gameSpeed || 1}
                onChange={(value: number | null) => {
                  if (value !== null) {
                    setData((prev) =>
                      prev ? { ...prev, gameSpeed: value } : prev,
                    );
                  }
                }}
                onBlur={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value) && value > 0) {
                    setSomeGameSettings("gameSpeed", value);
                  }
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="tool-section-heading">
          <div>
            <Typography.Title level={4}>游戏设置</Typography.Title>
            <Typography.Text type="secondary">开关会立即发送到当前游戏</Typography.Text>
          </div>
        </div>
        <div className="home-settings-card">
          <SettingSwitch
            title="随机遇敌"
            description="控制地图移动时是否触发战斗"
            checked={data?.isEncounterEnabled}
            tooltip="部分游戏可能不会响应此设置"
            onChange={(checked) =>
              setSomeGameSettings("isEncounterEnabled", checked)
            }
          />
          <SettingSwitch
            title="队伍整编"
            description="允许在菜单中调整出战队伍"
            checked={data?.isFormationEnabled}
            tooltip="部分没有队伍展示的游戏不建议开启"
            onChange={(checked) =>
              setSomeGameSettings("isFormationEnabled", checked)
            }
          />
          <SettingSwitch
            title="穿墙模式"
            description="忽略地图碰撞并自由移动"
            checked={data?.through}
            onChange={(checked) => setSomeGameSettings("through", checked)}
          />
          <SettingSwitch
            title="一击秒杀"
            description="我方角色造成正伤害时直接击败敌人"
            checked={data?.oneHitKillEnabled}
            tooltip="部分自定义战斗插件可能不会响应此设置"
            onChange={(checked) =>
              setSomeGameSettings("oneHitKillEnabled", checked)
            }
          />
        </div>
      </section>

      <section className="home-section">
        <div className="tool-section-heading">
          <div>
            <Typography.Title level={4}>快捷操作</Typography.Title>
            <Typography.Text type="secondary">需要特定游戏状态的即时指令</Typography.Text>
          </div>
        </div>
        <div className="home-action-grid">
          <Tooltip title="需处于战斗状态">
            <Button
              className="home-action-card"
              size="small"
              onClick={handleAchieveVictory}
            >
              战斗取得胜利
            </Button>
          </Tooltip>
          <Tooltip title="需处于战斗状态">
            <Button
              className="home-action-card"
              size="small"
              danger
              onClick={handleAchieveDefeat}
            >
              战斗强制失败
            </Button>
          </Tooltip>
          {/* <Tooltip title="需处于战斗状态">
            <Button
              className="home-action-card"
              size="small"
              onClick={handleEscapeBattle}
            >
              战斗强制逃跑
            </Button>
          </Tooltip> */}
        </div>
      </section>
    </div>
  );
};

export default Home;
