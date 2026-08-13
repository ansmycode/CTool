import { useEffect, useRef, useState } from "react";

const MIN_TABLE_BODY_HEIGHT = 120;

/** 根据 TabPane 实际分配的空间计算 Ant Table 表体高度。 */
export function useTableScrollY() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(MIN_TABLE_BODY_HEIGHT);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateHeight = () => {
      const header = container.querySelector<HTMLElement>(".ant-table-thead");
      const availableHeight = container.clientHeight - (header?.offsetHeight ?? 0);
      setScrollY(Math.max(MIN_TABLE_BODY_HEIGHT, Math.floor(availableHeight)));
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return { containerRef, scrollY };
}
