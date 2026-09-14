import type { GameSessionSnapshot } from "@/types/GameSession";
import type { GameDatabaseAccess } from "@/game/database";
import { Button, Select, Space, message } from "antd";
import GoldEditor from "@/ui/CheatMenu/GoldEditor";
import type { GoldWriteExpectation } from "@/game/database";

export default function GoldReadout({
  gold,
  access,
  onWrite,
}: {
  gold?: NonNullable<GameSessionSnapshot["telemetry"]>["gold"];
  access?: GameDatabaseAccess;
  onWrite?: (value: number, expectation: GoldWriteExpectation) => Promise<void>;
}) {
  if (!gold) return null;
  return (
    <section aria-label="金币监测与修改">
      <h3>金币</h3>
      {gold.status === "available" ? (
        <>
          <GoldEditor
            key={JSON.stringify(
              gold.source && [
                gold.source.kind,
                gold.source.table,
                gold.source.row,
                gold.source.field,
              ],
            )}
            value={gold.value}
            disabled={!onWrite || !gold.source || gold.source.kind !== 1}
            onApply={async (value, expected) => {
              if (!onWrite || !gold.source) throw new Error("金币来源未就绪");
              await onWrite(value, { value: expected, source: gold.source });
            }}
          />
          <p>
            更新于 {new Date(gold.observedAt).toLocaleTimeString()} · 每秒采集
          </p>
          {gold.source && (
            <p>
              {import.meta.env.DEV ? `来源：${gold.source.label} · ` : ""}
              {gold.source.mode === "auto"
                ? "基本系统规则识别（请核对游戏菜单）"
                : "手动绑定"}
            </p>
          )}
        </>
      ) : (
        <>
          <p>
            暂未读取到金币：请进入地图或读取存档；也可能是此游戏的数据结构尚不支持。
          </p>
          {import.meta.env.DEV && <small>诊断：{gold.reason}</small>}
        </>
      )}
      {import.meta.env.DEV && access && (
        <Space wrap>
          {!!gold.candidates?.length && (
            <Select
              style={{ minWidth: 300 }}
              placeholder="选择金币候选字段"
              value={undefined}
              options={gold.candidates.map((c, i) => ({
                value: i,
                label: c.label,
              }))}
              onChange={(i: number) => {
                const c = gold.candidates?.[i];
                if (c)
                  void access
                    .selectGoldSource(c)
                    .catch((e) => message.error(String(e)));
              }}
            />
          )}
          <Button
            size="small"
            onClick={() =>
              void access
                .selectGoldSource(null)
                .catch((e) => message.error(String(e)))
            }
          >
            重新自动识别
          </Button>
        </Space>
      )}
    </section>
  );
}
