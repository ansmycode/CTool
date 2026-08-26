import { useCallback, useEffect, useState } from "react";

/** 将表格临时编辑值与只读 Props 数据分离。 */
export function useTableDraftValues<T>(source: unknown) {
  const [draftValues, setDraftValues] = useState<Record<number, T>>({});

  useEffect(() => {
    setDraftValues({});
  }, [source]);

  const getDraftValue = useCallback(
    (id: number, fallback: T): T =>
      Object.prototype.hasOwnProperty.call(draftValues, id)
        ? draftValues[id]
        : fallback,
    [draftValues],
  );

  const setDraftValue = useCallback((id: number, value: T) => {
    setDraftValues((current) => ({ ...current, [id]: value }));
  }, []);

  return { getDraftValue, setDraftValue };
}
