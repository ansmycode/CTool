import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Switch, Typography } from "antd";
import type { ReactNode } from "react";
import BlurNumberInput from "../../shared/components/BlurNumberInput";
import { runtimeError } from "@/game/runtime";
import type { GameRuntimeAccess, WolfRuntimeStatus } from "@/game/runtime";

export default function WolfRuntimeControls({ access, active, enabled, goldContent, refreshToken = 0 }: {
  access: GameRuntimeAccess; active: boolean; enabled: boolean; goldContent: ReactNode; refreshToken?: number;
}) {
  const [state, setState] = useState<WolfRuntimeStatus>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const working = useRef(false), generation = useRef(0);
  const invalidate = useCallback(() => { ++generation.current; }, []);
  const refresh = useCallback(async () => {
    if (!enabled || working.current) return;
    const id = ++generation.current;
    try {
      const next = await access.status();
      if (generation.current !== id) return;
      setState(next); setError("");
    } catch (e) { if (generation.current === id) setError(String(e instanceof Error ? e.message : e)); }
  }, [access, enabled]);
  useEffect(() => {
    if (!active || !enabled) return;
    void refresh();
    const focus = () => { void refresh(); };
    window.addEventListener("focus", focus);
    return () => { invalidate(); window.removeEventListener("focus", focus); };
  }, [active, enabled, refresh, invalidate, refreshToken]);
  const apply = async (kind: "speed" | "noclip", value: number | boolean) => {
    if (working.current) throw new Error("操作进行中，请稍后重试");
    working.current = true; setBusy(true); setError("");
    const id = ++generation.current;
    try {
      if (kind === "speed") await access.setSpeed(value as number);
      else await access.setNoclip(value as boolean);
      const next = await access.status();
      if (generation.current !== id) return;
      setState(next);
    } catch (e) { if (generation.current === id) setError(String(e instanceof Error ? e.message : e)); throw e; }
    finally { working.current = false; setBusy(false); }
  };
  return <>
    {!enabled && <Alert type="info" showIcon message="请更新原生组件并重启游戏，以使用变速和穿墙。" />}
    {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
    <section className="base-section">
      <div className="base-section-heading">
        <Typography.Title level={4}>常用数据</Typography.Title>
        <Typography.Text type="secondary">修改后离开输入框即可应用</Typography.Text>
      </div>
      <div className="base-value-grid">
        {goldContent}
        <div className="base-value-card">
          <div className="base-value-content">
        <Typography.Text>游戏倍率</Typography.Text>
        <BlurNumberInput label="游戏速度倍率" min={0.25} max={4} step={0.25} precision={2} value={state?.speed.value}
          disabled={!enabled || !state?.speed.available || busy} onCommit={value => apply("speed", value)} />
          </div>
          <span className="base-value-note">{state && !state.speed.available ? runtimeError(state.speed.reason) : '倍率范围 0.25–4 ×'}</span>
        </div>
      </div>
    </section>
    <section className="base-section">
      <div className="base-section-heading">
        <Typography.Title level={4}>游戏设置</Typography.Title>
        <Button size="small" onClick={() => void refresh()} disabled={!enabled || busy}>刷新状态</Button>
      </div>
      <div className="base-settings-card">
        <div className="base-setting-row">
          <span className="base-setting-copy">
            <Typography.Text strong>穿墙模式</Typography.Text>
            <Typography.Text type="secondary">{state && !state.noclip.available ? runtimeError(state.noclip.reason) : '忽略地图碰撞并自由移动'}</Typography.Text>
          </span>
        <Switch size="small" checkedChildren="开" unCheckedChildren="关" aria-label="穿墙开关" checked={state?.noclip.value ?? false} loading={busy}
          disabled={!enabled || !state?.noclip.available || busy} onChange={value => void apply("noclip", value).catch(() => {})} />
        </div>
      </div>
    </section>
  </>;
}
