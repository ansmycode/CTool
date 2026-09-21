import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Space, Switch, Typography } from "antd";
import BlurNumberInput from "../../shared/components/BlurNumberInput";
import { runtimeError } from "@/game/runtime";
import type { GameRuntimeAccess, WolfRuntimeStatus } from "@/game/runtime";

export default function WolfRuntimeControls({ access, active, enabled }: {
  access: GameRuntimeAccess; active: boolean; enabled: boolean;
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
  }, [active, enabled, refresh, invalidate]);
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
  return <Card title="游戏速度与通行" extra={<Button onClick={() => void refresh()} disabled={!enabled || busy}>刷新状态</Button>}>
    {!enabled && <Alert type="info" showIcon message="请更新原生组件并重启游戏，以使用变速和穿墙。" />}
    {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Space wrap>
        <Typography.Text>游戏速度</Typography.Text>
        <BlurNumberInput label="游戏速度倍率" min={0.25} max={4} step={0.25} precision={2} value={state?.speed.value}
          disabled={!enabled || !state?.speed.available || busy} onCommit={value => apply("speed", value)} />
        <Typography.Text type="secondary">倍 · 失焦自动保存</Typography.Text>
        {state?.speed.available && <Typography.Text type="secondary">当前 {state.speed.value} 倍</Typography.Text>}
        {state && !state.speed.available && <Typography.Text type="secondary">{runtimeError(state.speed.reason)}</Typography.Text>}
      </Space>
      <Space wrap>
        <Typography.Text>穿墙</Typography.Text>
        <Switch aria-label="穿墙开关" checked={state?.noclip.value ?? false} loading={busy}
          disabled={!enabled || !state?.noclip.available || busy} onChange={value => void apply("noclip", value).catch(() => {})} />
        {state && !state.noclip.available && <Typography.Text type="secondary">{runtimeError(state.noclip.reason)}</Typography.Text>}
      </Space>
    </Space>
  </Card>;
}
