import { useState } from "react";
import {
  Alert,
  Button,
  InputNumber,
  Space,
  Statistic,
  Typography,
  message,
} from "antd";

/** Wolf keeps the original value while editing to detect runtime conflicts. */
export default function WolfGoldEditor({
  value,
  disabled = false,
  onApply,
}: {
  value?: number;
  disabled?: boolean;
  onApply: (value: number, expected: number) => Promise<void>;
}) {
  const [draft, setDraft] = useState<{ value: number; expected: number }>();
  const [busy, setBusy] = useState(false);
  const conflict = draft !== undefined && draft.expected !== value;
  const apply = async () => {
    if (!draft || value === undefined || busy || disabled || conflict) return;
    setBusy(true);
    try {
      await onApply(draft.value, draft.expected);
      setDraft(undefined);
      message.success("金币修改已确认");
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Statistic title="持有金币" value={value ?? "—"} groupSeparator="," />
      {!disabled && (
        <Space wrap>
          <InputNumber
            aria-label="目标金币"
            min={0}
            max={2147483647}
            precision={0}
            value={draft?.value ?? value}
            disabled={busy || value === undefined}
            style={{ width: 200 }}
            onChange={(next) => {
              if (next !== null && value !== undefined)
                setDraft((previous) => ({
                  value: Number(next),
                  expected: previous?.expected ?? value,
                }));
            }}
          />
          <Button
            type="primary"
            loading={busy}
            disabled={!draft || conflict}
            onClick={() => void apply()}
          >
            应用到游戏
          </Button>
          <Button disabled={!draft || busy} onClick={() => setDraft(undefined)}>
            恢复当前值
          </Button>
        </Space>
      )}
      {conflict && (
        <Alert
          type="warning"
          showIcon
          message="游戏中的金币已变化，请恢复当前值后重新编辑。"
        />
      )}
      <Typography.Text type="secondary">
        {disabled
          ? "当前仅支持读取。"
          : "输入后点击应用；建议先在游戏中保存存档。"}
      </Typography.Text>
    </Space>
  );
}
