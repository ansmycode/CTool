import { Typography } from "antd";
import BlurNumberInput from "../../shared/components/BlurNumberInput";
export default function WolfGoldEditor({ value, disabled = false, onApply }: {
  value?: number; disabled?: boolean; onApply: (value: number, expected: number) => Promise<void>;
}) {
  return <>
    <div className="base-value-content">
      <Typography.Text>持有金币</Typography.Text>
      <BlurNumberInput label="目标金币" value={value} disabled={disabled} onCommit={onApply} />
    </div>
    {disabled && <Typography.Text className="base-value-note">当前仅支持读取</Typography.Text>}
  </>;
}
