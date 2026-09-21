import type { DatabaseTable, GameDatabaseAccess } from "@/game/database";
import type { GameRuntimeAccess, VariablePage } from "@/game/runtime";

/** The engine's variable debug view joins group g to system table 14 + g.
 * Names are schema row labels, not values in the variable database.
 * Keep this cache inside the session adapter and rebuild it on every refresh.
 */
export function withVariableNames(runtime: GameRuntimeAccess, database: GameDatabaseAccess): GameRuntimeAccess {
  let tables = new Map<number, DatabaseTable>();
  let reason = "变量名称尚未读取";
  let revision = 0;
  return {
    ...runtime,
    async groups() {
      const generation = ++revision;
      tables = new Map();
      const catalog = await runtime.groups();
      const next = new Map<number, DatabaseTable>();
      let nextReason = "";
      try {
        for (let start = 0; start < 4096;) {
          const result = await database.read({ operation: "catalog", kind: 2, start, limit: 8 });
          if (result.status !== "available" || !("tables" in result)) throw new Error("系统数据库不可读");
          for (const table of result.tables) next.set(table.id, table);
          start += result.tables.length;
          if (start >= result.total) break;
          if (!result.tables.length || start >= 4096) throw new Error("系统数据库目录不完整");
        }
      } catch (e) { next.clear(); nextReason = e instanceof Error ? e.message : String(e); }
      if (generation === revision) { tables = next; reason = nextReason; }
      return { ...catalog, groups: catalog.groups.map(group => {
        const table = next.get(14 + group.id);
        return { ...group, name: group.id <= 9 && table?.fieldCount === 0 && table.rowCount === group.count
          ? `${table.name || "变量组"} · ${group.id}` : undefined };
      }) };
    },
    async page(group, start, limit): Promise<VariablePage> {
      const generation = revision;
      const value = await runtime.page(group, start, limit);
      const table = tables.get(14 + group);
      const unavailable = (message: string) => ({ ...value, metadataReason: `名称暂不可用：${message}。仍可按原始组和 ID 查看数值。` });
      if (reason) return unavailable(reason);
      if (group > 9 || !table || table.fieldCount !== 0 || table.rowCount !== value.total)
        return unavailable("名称表与运行时变量结构不匹配");
      const names = new Map<number, string>();
      try {
        for (let offset = start; offset < start + value.rows.length; offset += 10) {
          const count = Math.min(10, start + value.rows.length - offset);
          const result = await database.read({ operation: "page", kind: 2, table: table.id, start: offset, limit: count, fieldStart: 0, fieldLimit: 1 });
          if (result.status !== "available" || !("rows" in result) || result.name !== table.name ||
            result.total !== value.total || result.fieldCount !== 0 || result.rows.length !== count ||
            !result.rows.every((row, i) => row.id === offset + i)) throw new Error("名称表读取失败或结构已变化");
          for (const row of result.rows) names.set(row.id, row.name);
        }
        if (generation !== revision) return unavailable("刷新已更新名称映射");
        return { ...value, rows: value.rows.map(row => ({ ...row, name: names.get(row.id) })) };
      } catch (e) { return unavailable(e instanceof Error ? e.message : String(e)); }
    },
  };
}
