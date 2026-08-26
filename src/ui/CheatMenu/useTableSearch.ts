import { useDeferredValue, useMemo, useState } from "react";

export function useTableSearch<T>(
  data: T[] | undefined,
  getSearchValues: (item: T) => unknown[],
) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filteredData = useMemo(() => {
    const terms = deferredQuery
      .trim()
      .toLocaleLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    if (terms.length === 0) return data ?? [];

    return (data ?? []).filter((item) => {
      const searchableText = getSearchValues(item)
        .map((value) => String(value ?? "").toLocaleLowerCase())
        .join("\n");
      return terms.every((term) => searchableText.includes(term));
    });
  }, [data, deferredQuery, getSearchValues]);

  return {
    query,
    setQuery,
    filteredData,
    filteredCount: filteredData.length,
    totalCount: data?.length ?? 0,
  };
}
