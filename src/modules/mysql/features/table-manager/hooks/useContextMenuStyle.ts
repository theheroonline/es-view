import { useCallback, type CSSProperties } from "react";

export function useContextMenuStyle() {
  const getContextMenuStyle = useCallback(
    (x: number, y: number, minWidth: number, estimatedHeight: number): CSSProperties => {
      const viewportWidth = typeof window !== "undefined" ? window.innerWidth : minWidth + 16;
      const viewportHeight = typeof window !== "undefined" ? window.innerHeight : estimatedHeight + 16;
      const left = Math.max(8, Math.min(x, viewportWidth - minWidth - 8));
      const top = Math.max(8, Math.min(y, viewportHeight - estimatedHeight - 8));

      return {
        position: "fixed",
        left: `${left}px`,
        top: `${top}px`,
        minWidth: `${minWidth}px`,
        maxHeight: `${Math.max(180, viewportHeight - 16)}px`,
        overflowY: "auto"
      };
    },
    []
  );

  return { getContextMenuStyle };
}
