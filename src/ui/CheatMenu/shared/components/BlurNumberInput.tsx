import { useRef, useState } from "react";
import { InputNumber, message } from "antd";

/** Preserve the editing baseline across background refreshes. */
export default function BlurNumberInput({ value, onCommit, disabled, min = 0, max = 2147483647, precision = 0, step = 1, label }: {
  value?: number; onCommit: (value: number, expected: number) => Promise<void>;
  disabled?: boolean; min?: number; max?: number; precision?: number; step?: number; label: string;
}) {
  const [draft, setDraft] = useState<{ value: number | null; expected: number }>();
  const current = useRef(draft), baseline = useRef<number | undefined>(undefined);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const commit = async () => {
    const edit = current.current;
    baseline.current = undefined;
    if (!edit || pending.current || disabled) return;
    current.current = undefined; setDraft(undefined);
    if (edit.value === null || !Number.isFinite(edit.value) || edit.value < min || edit.value > max ||
      (precision === 0 && !Number.isInteger(edit.value)) || edit.value === edit.expected) return;
    pending.current = true; setBusy(true);
    try { await onCommit(edit.value, edit.expected); }
    catch (e) { message.error(e instanceof Error ? e.message : String(e)); }
    finally { pending.current = false; setBusy(false); }
  };
  return <InputNumber aria-label={label} value={draft ? draft.value : value} min={min} max={max} precision={precision} step={step} changeOnBlur={false}
    disabled={disabled || busy || value === undefined}
    onFocus={() => { baseline.current = value; }}
    onChange={next => {
      const expected = current.current?.expected ?? baseline.current ?? value;
      if (expected === undefined) return;
      current.current = { value: next, expected }; setDraft(current.current);
    }}
    onBlur={() => void commit()} onPressEnter={event => event.currentTarget.blur()} />;
}
