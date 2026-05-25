import { useCallback, useRef, useState } from "react";

export interface MysqlSplitLayoutProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
}

const MIN_WIDTH = 200;
const MAX_WIDTH = 500;
const STORAGE_KEY = "mysql-table-list-width";

function loadWidth(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const val = parseInt(stored, 10);
      if (val >= MIN_WIDTH && val <= MAX_WIDTH) return val;
    }
  } catch {
    // ignore
  }
  return 280;
}

function saveWidth(width: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(width));
  } catch {
    // ignore
  }
}

export function MysqlSplitLayout({ leftPanel, rightPanel }: MysqlSplitLayoutProps) {
  const [width, setWidth] = useState(loadWidth);
  const [collapsed, setCollapsed] = useState(false);
  const isResizingRef = useRef(false);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = ev.clientX - startX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      saveWidth(width);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [width]);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      if (!next) saveWidth(width);
      return next;
    });
  }, [width]);

  return (
    <div className="mysql-split-layout">
      {!collapsed && (
        <>
          <div className="mysql-split-left" style={{ width: `${width}px` }}>
            {leftPanel}
          </div>
          <div
            className="mysql-split-resizer"
            onMouseDown={handleResizeStart}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize table list"
          />
        </>
      )}
      <div className="mysql-split-right">
        <button
          className="mysql-split-collapse-btn"
          onClick={toggleCollapse}
          title={collapsed ? "展开表列表" : "收起表列表"}
        >
          {collapsed ? "▶" : "◀"}
        </button>
        {rightPanel}
      </div>
    </div>
  );
}
