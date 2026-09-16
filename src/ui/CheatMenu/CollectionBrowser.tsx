import { useEffect, useMemo, useState } from "react";
import { Button, Space, Tooltip, Typography } from "antd";
import type { GameCollection, GameCollectionAccess } from "@/game/database";
import InventoryTable from "./InventoryTable";
type Row = Awaited<ReturnType<GameCollectionAccess["page"]>>["rows"][number];
export default function CollectionBrowser({
  access,
  group,
  active,
  writeEnabled,
  refreshToken,
}: {
  access: GameCollectionAccess;
  group: GameCollection;
  active: boolean;
  writeEnabled: boolean;
  refreshToken: number;
}) {
  const [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState("");
  const [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0),
    [progress, setProgress] = useState("");
  useEffect(() => {
    if (!active) return;
    let disposed = false;
    const load = async () => {
      setLoading(true);
      try {
        const all: Row[] = [];
        let total: number | undefined;
        for (let start = 0; start < (total ?? 1); start += 10) {
          const result = await access.page(group.key, start);
          if (disposed) return;
          if (total !== undefined && result.total !== total)
            throw new Error("资料结构发生变化，请刷新");
          total = result.total;
          all.push(...result.rows);
          setProgress(`读取 ${Math.min(start + 10, total)} / ${total}`);
        }
        if (!disposed) {
          setRows(all);
          setError("");
        }
      } catch (e) {
        if (!disposed) {
          setRows([]);
          setError(String(e instanceof Error ? e.message : e));
        }
      } finally {if (!disposed) {setLoading(false);setProgress("");}}
    };
    void load();
    return () => {
      disposed = true;
    };
  }, [access, group.key, active, revision, refreshToken]);
  const tableRows = useMemo(
    () =>
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        playerHasCount: row.owned,
        countError: row.ownedReason,
        countWritable: row.writable,
      })),
    [rows],
  );
  const changeCount = async (id: number, value: number) => {
    const row = rows.find((item) => item.id === id);
    if (!writeEnabled || !row || row.owned === undefined || !row.writable || !row.inventoryTarget) return;
    try {
      await access.setCount(row.inventoryTarget, row.owned, value);
      setRevision((current) => current + 1);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  };
  return (
    <div className="wolf-collection-page">
      <InventoryTable
        rows={tableRows}
        onChangeCount={group.writable && writeEnabled ? changeCount : undefined}
        showId={false}
        showDescription
        emptyText={loading ? "正在读取资料…" : "没有匹配条目"}
        toolbar={
          <Space className="wolf-collection-toolbar" wrap>
            <Typography.Text type="secondary">{group.writable && writeEnabled ? "可修改已分配的数量槽" : "数量只读"}</Typography.Text>
            <Button
              size="small"
              loading={loading}
              onClick={() => setRevision((x) => x + 1)}
            >
              刷新
            </Button>
            <Tooltip title="列出全部物品定义，用背包数量按 ID 匹配；背包中没有的物品显示 0。读取失败或映射未确认时显示未知。">
              <Typography.Text type="secondary">说明 ⓘ</Typography.Text>
            </Tooltip>
            <Typography.Text type="secondary">{progress}</Typography.Text>
          </Space>
        }
      />
      {error && <Typography.Text type="danger">{error}</Typography.Text>}
    </div>
  );
}
