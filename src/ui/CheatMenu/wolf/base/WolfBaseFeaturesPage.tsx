import { Alert, Card, Collapse, Space, Tag, Typography } from "antd";
import type { GameSessionSnapshot } from "@/types/GameSession";
import type { GameDatabaseAccess, GoldWriteExpectation } from "@/game/database";
import WolfGoldReadout from "./WolfGoldReadout";
import WolfRuntimeControls from "./WolfRuntimeControls";
import type { GameRuntimeAccess } from "@/game/runtime";

/**
 * Wolf's base features: bound gold editing and independently detected runtime controls.
 */
export default function WolfBaseFeaturesPage({
  session,
  access,
  onWrite,
  runtime,
  active,
}: {
  session: GameSessionSnapshot;
  access: GameDatabaseAccess;
  runtime?: GameRuntimeAccess;
  active: boolean;
  onWrite?: (
    value: number,
    expectation?: GoldWriteExpectation,
  ) => Promise<void>;
}) {
  return (
    <div className="runtime-page">
      <header className="tool-page-header">
        <div>
          <Typography.Title level={3}>
            {session.game?.title} · 游戏控制台
          </Typography.Title>
          <Typography.Text type="secondary">
            实时读取当前游戏，按已验证能力开放修改
          </Typography.Text>
        </div>
        <Space>
          <Tag color="green">DLL 已连接</Tag>
          <Tag>{session.game?.engine}</Tag>
        </Space>
      </header>
      <Card>
        <WolfGoldReadout
          gold={session.telemetry?.gold}
          access={access}
          onWrite={session.goldWritable ? onWrite : undefined}
        />
        {!session.telemetry?.gold && (
          <Alert
            type="info"
            showIcon
            message="正在识别金币来源，请进入地图或读取存档。"
          />
        )}
      </Card>
      {runtime && <WolfRuntimeControls key={session.sessionId} access={runtime} active={active} enabled={!!session.runtimeAvailable} />}
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        金币可修改；已确认且已分配的库存数量可修改。游戏菜单若未更新，请重新打开菜单。
      </Typography.Text>
      {import.meta.env.DEV && (
        <Collapse
          items={[
            {
              key: "connection",
              label: "连接与诊断（DEV）",
              children: (
                <>
                  <p>
                    PID：{session.pid} · 版本：{session.game?.version}
                  </p>
                  <p>{session.message}</p>
                  <p>
                    金币写入协议：
                    {session.goldWritable
                      ? "已连接"
                      : "未提供，请更新 DLL 后重启游戏"}
                  </p>
                  <p>
                    修改作用于运行内存；是否保存到存档由游戏自己的存档流程决定。请勿在读档、切换场景时提交修改。
                  </p>
                </>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
