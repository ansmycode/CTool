import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Input, Select, Space, Table, Pagination } from "antd";
import type {
  GameDatabaseAccess,
  DatabaseResult,
  DatabaseTable,
} from "@/game/database";
type Page = Extract<DatabaseResult, { rows: unknown }>;
export default function DatabaseBrowser({
  access,
}: {
  access: GameDatabaseAccess;
}) {
  const [kind, setKind] = useState(1),
    [tables, setTables] = useState<DatabaseTable[]>([]),
    [selected, setSelected] = useState<number>();
  const [start, setStart] = useState(0),
    [fieldStart, setFieldStart] = useState(0),
    [filter, setFilter] = useState("");
  const [page, setPage] = useState<Page>(),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let disposed = false;
    setTables([]);
    setSelected(undefined);
    setPage(undefined);
    setError("");
    setLoading(true);
    const load = async () => {
      try {
        const all: DatabaseTable[] = [];
        for (let offset = 0; offset < 4096; ) {
          const result = await access.read({
            operation: "catalog",
            kind,
            start: offset,
            limit: 8,
          });
          if (disposed) return;
          if (result.status !== "available") throw new Error(result.reason);
          if (!("tables" in result)) throw new Error("目录响应类型错误");
          all.push(...result.tables);
          offset += result.tables.length;
          if (offset >= result.total) break;
          if (!result.tables.length) throw new Error("数据库目录不完整");
        }
        if (!disposed) setTables(all);
      } catch (e) {
        if (!disposed) {
          const error = e instanceof Error ? e.message : String(e);
          setError(error);
        }
      } finally {
        if (!disposed) setLoading(false);
      }
    };
    void load();
    return () => {
      disposed = true;
    };
  }, [access, kind, refresh]);
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    setPage(undefined);
    if (selected === undefined) return;
    const load = async () => {
      try {
        const result = await access.read({
          operation: "page",
          kind,
          table: selected,
          start,
          limit: 10,
          fieldStart,
          fieldLimit: 16,
        });
        if (disposed) return;
        if (result.status !== "available") throw new Error(result.reason);
        if (!("rows" in result)) throw new Error("记录响应类型错误");
        setPage(result);
        setError("");
      } catch (e) {
        if (!disposed) {
          setPage(undefined);
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!disposed) timer = setTimeout(load, 2000);
      }
    };
    void load();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [access, kind, selected, start, fieldStart, refresh]);
  const options = useMemo(
    () =>
      tables
        .filter((t) =>
          `${t.id} ${t.name} ${t.category || ""}`
            .toLowerCase()
            .includes(filter.toLowerCase()),
        )
        .map((t) => ({
          value: t.id,
          label: `${t.id} · ${t.name} (${t.rowCount} 条)${t.category ? ` · ${t.category}` : ""}`,
        })),
    [tables, filter],
  );
  return (
    <section style={{ marginTop: 24 }} aria-label="游戏数据库只读浏览">
      <h3>游戏数据库（只读）</h3>
      <p>
        仅供开发调试。数据库标签不代表玩家持有数据；此处不提供字段绑定或修改。
      </p>
      <Space wrap>
        <Select
          aria-label="数据库类型"
          value={kind}
          style={{ width: 160 }}
          onChange={(v) => {
            setKind(v);
            setSelected(undefined);
            setStart(0);
            setFieldStart(0);
          }}
          options={[
            { value: 0, label: "用户数据库（定义）" },
            { value: 1, label: "可变数据库（状态）" },
            { value: 2, label: "系统数据库" },
          ]}
        />
        <Input
          aria-label="搜索数据表"
          placeholder="搜索表名、道具、装备"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ width: 220 }}
        />
        <Button loading={loading} onClick={() => setRefresh((x) => x + 1)}>
          刷新目录
        </Button>
      </Space>
      <Select
        aria-label="数据表"
        placeholder={loading ? "正在读取目录…" : "选择数据表"}
        value={selected}
        options={options}
        style={{ width: "100%", margin: "12px 0" }}
        onChange={(v) => {
          setSelected(v);
          setStart(0);
          setFieldStart(0);
          setPage(undefined);
        }}
      />
      {error && (
        <Alert
          type="warning"
          showIcon
          message="数据库暂不可读"
          description={`${error}。请先进入游戏场景，再刷新目录。`}
        />
      )}
      {page && (
        <>
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ x: "max-content" }}
            dataSource={page.rows}
            columns={[
              {
                title: "记录",
                key: "row",
                render: (_, row) => `${row.id} · ${row.name}`,
              },
              ...page.fields.map((field, i) => ({
                title: `${field.id} · ${field.name}`,
                key: field.id,
                render: (_: unknown, row: Page["rows"][number]) => (
                  <div
                    style={{
                      maxWidth: 320,
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {row.values[i] === null ? "不可读" : String(row.values[i])}
                  </div>
                ),
              })),
            ]}
          />
          <Space wrap style={{ marginTop: 12 }}>
            <Pagination
              size="small"
              current={Math.floor(start / 10) + 1}
              pageSize={10}
              total={page.total}
              showSizeChanger={false}
              onChange={(v) => setStart((v - 1) * 10)}
            />
            <span>
              字段 {fieldStart}–
              {Math.max(fieldStart, fieldStart + page.fields.length - 1)} /{" "}
              {page.fieldCount}
            </span>
            <Button
              disabled={fieldStart === 0}
              onClick={() => setFieldStart((x) => Math.max(0, x - 16))}
            >
              前16列
            </Button>
            <Button
              disabled={fieldStart + 16 >= page.fieldCount}
              onClick={() => setFieldStart((x) => x + 16)}
            >
              后16列
            </Button>
          </Space>
        </>
      )}
    </section>
  );
}
