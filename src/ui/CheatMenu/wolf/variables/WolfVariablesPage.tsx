import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, InputNumber, Select, Space, Table, Typography } from "antd";
import BlurNumberInput from "../../shared/components/BlurNumberInput";
import type { GameRuntimeAccess, VariableGroup, VariablePage, VariableRow } from "@/game/runtime";

export default function WolfVariablesPage({ access, active, enabled }: {
  access: GameRuntimeAccess; active: boolean; enabled: boolean;
}) {
  const [groups, setGroups] = useState<VariableGroup[]>([]);
  const [group, setGroup] = useState(0), [page, setPage] = useState(1);
  const [data, setData] = useState<VariablePage>();
  const [loading, setLoading] = useState(false), [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [jump, setJump] = useState<number | null>(null);
  const generation = useRef(0), working = useRef(false);
  const invalidate = useCallback(() => { ++generation.current; }, []);
  const refresh = useCallback(async (clearError = true) => {
    if (!active || !enabled || working.current) return;
    const id = ++generation.current; setLoading(true);
    try {
      const catalog = await access.groups();
      if (generation.current !== id) return;
      setGroups(catalog.groups);
      const current = catalog.groups.find(g => g.id === group);
      if (!current) { setData(undefined); setGroup(catalog.groups[0]?.id ?? 0); setPage(1); setError("暂无数值变量组"); return; }
      if (page > 1 && (page - 1) * 100 >= current.count) { setPage(1); return; }
      const next = await access.page(group, (page - 1) * 100, 100);
      if (generation.current !== id) return;
      setData(next); if (clearError) setError("");
    } catch (e) { if (generation.current === id) { setData(undefined); setError(String(e instanceof Error ? e.message : e)); } }
    finally { if (generation.current === id) setLoading(false); }
  }, [access, active, enabled, group, page]);
  useEffect(() => {
    void refresh();
    const focus = () => { void refresh(); };
    if (active && enabled) window.addEventListener("focus", focus);
    return () => { invalidate(); window.removeEventListener("focus", focus); };
  }, [active, enabled, refresh, invalidate]);
  const save = async (row: VariableRow, value: number, expected: number) => {
    if (working.current) throw new Error("正在保存其他变量，请稍后重试");
    working.current = true; setSaving(true); ++generation.current;
    try {
      await access.setVariable(group, row.id, expected, value);
      setData(previous => previous?.group === group ? { ...previous, rows: previous.rows.map(item => item.id === row.id ? { ...item, value } : item) } : previous);
      setError("");
    } catch (e) { setError(String(e instanceof Error ? e.message : e)); throw e; }
    finally { working.current = false; setSaving(false); void refresh(false); }
  };
  return <div className="runtime-page">
    <Typography.Title level={3}>数值变量</Typography.Title>
    <Typography.Paragraph type="secondary">名称来自游戏系统数据库，按变量组和 ID 关联；修改后失焦自动保存。</Typography.Paragraph>
    {!enabled && <Alert type="info" showIcon message="请更新原生组件并重启游戏。" />}
    {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
    <Space wrap style={{ marginBottom: 16 }}>
      <Select aria-label="变量组" value={groups.length ? group : undefined} style={{ minWidth: 220 }} disabled={saving || !enabled}
        options={groups.map(g => ({ value: g.id, label: `${g.name || `变量组 ${g.id}`}（${g.count} 项）` }))}
        onChange={v => { setGroup(v); setPage(1); setData(undefined); }} />
      <Button onClick={() => void refresh()} disabled={saving || !enabled} loading={loading}>刷新</Button>
      <InputNumber aria-label="定位变量 ID" min={0} max={Math.max(0,(data?.total ?? 1)-1)} precision={0}
        placeholder="变量 ID" value={jump} onChange={setJump} disabled={saving} />
      <Button disabled={saving || jump === null || !data || jump >= data.total}
        onClick={() => jump !== null && setPage(Math.floor(jump / 100) + 1)}>定位所在页</Button>
    </Space>
    {data?.metadataReason && <Alert type="info" showIcon message={data.metadataReason} style={{ marginBottom: 12 }} />}
    <Table<VariableRow> rowKey={row => `${group}:${row.id}`} size="small" loading={loading} dataSource={data?.group === group ? data.rows : []}
      pagination={{ current: page, pageSize: 100, total: data?.total ?? 0, showSizeChanger: false, disabled: saving,
        onChange: next => { setPage(next); setData(undefined); } }}
      columns={[
        { title: "变量 ID", dataIndex: "id", width: 150 },
        { title: "名称 / 用途", dataIndex: "name", render: (name: string | undefined) => name === undefined ? "名称不可用" : name.trim() || "未命名" },
        { title: "当前值", width: 200, render: (_, row) => <BlurNumberInput label={`变量 ${group}:${row.id}`} value={row.value}
          min={-2147483648} disabled={!enabled || saving} onCommit={(value, expected) => save(row, value, expected)} /> },
      ]} />
  </div>;
}
