import { Space, Statistic, Typography } from "antd";
import BlurNumberInput from "../../shared/components/BlurNumberInput";
export default function WolfGoldEditor({ value, disabled = false, onApply }: {
  value?: number; disabled?: boolean; onApply: (value: number, expected: number) => Promise<void>;
}) {
  return <Space direction="vertical" size="middle" style={{ width: "100%" }}>
    <Statistic title="持有金币" value={value ?? "—"} groupSeparator="," />
    {!disabled && <BlurNumberInput label="目标金币" value={value} onCommit={onApply} />}
    <Typography.Text type="secondary">{disabled ? "当前仅支持读取。" : "修改后离开输入框自动保存。"}</Typography.Text>
  </Space>;
}
