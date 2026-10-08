import { Button, Modal, Space, Tag, Typography } from "antd";
import { useState } from "react";
import type { GameSessionSnapshot } from "@/types/GameSession";
import type { GameDatabaseAccess, GoldWriteExpectation } from "@/game/database";
import WolfGoldReadout from "./WolfGoldReadout";
import WolfRuntimeControls from "./WolfRuntimeControls";
import type { GameRuntimeAccess } from "@/game/runtime";
import "../../shared/baseFeatures.css";

/**
 * Wolf's base features: bound gold editing and independently detected runtime controls.
 */
export default function WolfBaseFeaturesPage({
  session,
  access,
  onWrite,
  runtime,
  active,
  refreshToken = 0,
}: {
  session: GameSessionSnapshot;
  access: GameDatabaseAccess;
  runtime?: GameRuntimeAccess;
  active: boolean;
  refreshToken?: number;
  onWrite?: (
    value: number,
    expectation?: GoldWriteExpectation,
  ) => Promise<void>;
}) {
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const goldContent = <WolfGoldReadout gold={session.telemetry?.gold} access={access} onWrite={session.goldWritable ? onWrite : undefined} />;
  return (
    <div className="base-features-page">
      <header className="tool-page-header">
        <div>
          <Typography.Title level={3}>
            游戏控制台
          </Typography.Title>
          <Typography.Text type="secondary">
            调整常用游戏数据与运行设置
          </Typography.Text>
        </div>
        <Space>
          <Tag color="green">已连接</Tag>
          <Tag>{session.game?.engine}</Tag>
        </Space>
      </header>
      {runtime ? <WolfRuntimeControls key={session.sessionId} access={runtime} active={active} enabled={!!session.runtimeAvailable} goldContent={goldContent} refreshToken={refreshToken} /> : (
        <section className="base-section">
          <div className="base-section-heading"><Typography.Title level={4}>常用数据</Typography.Title><Typography.Text type="secondary">修改后离开输入框即可应用</Typography.Text></div>
          <div className="base-value-grid">{goldContent}</div>
        </section>
      )}
      <div className="base-footer">切回工具时同步数据；游戏菜单未更新时，请重新打开菜单。</div>
      {import.meta.env.DEV && (
        <>
          <Button type="link" size="small" onClick={() => setDiagnosticsOpen(true)}>连接与诊断（DEV）</Button>
          <Modal title="连接与诊断（DEV）" open={diagnosticsOpen} onCancel={() => setDiagnosticsOpen(false)} footer={null}>
                <WolfGoldReadout gold={session.telemetry?.gold} access={access} showDiagnostics />
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
          </Modal>
        </>
      )}
    </div>
  );
}
