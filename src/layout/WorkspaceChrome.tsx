import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

interface WorkspaceChromeProps {
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  sidebarWidth: number;
  onSidebarWidthChange: (width: number) => void;
  brand: string;
  windowHint: string;
  topbarRight: ReactNode;
  sidebarContent: ReactNode;
  sidebarFooter?: ReactNode;
  workspace: ReactNode;
  emptyState: ReactNode;
  canShowWorkspace: boolean;
}

export default function WorkspaceChrome({
  isSidebarCollapsed,
  onToggleSidebar,
  sidebarWidth,
  onSidebarWidthChange,
  brand,
  windowHint,
  topbarRight,
  sidebarContent,
  sidebarFooter,
  workspace,
  emptyState,
  canShowWorkspace,
}: WorkspaceChromeProps) {
  const mainRef = useRef<HTMLDivElement | null>(null);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  useEffect(() => {
    if (!isResizingSidebar) {
      return;
    }

    const handleMouseMove = (event: globalThis.MouseEvent) => {
      const mainRect = mainRef.current?.getBoundingClientRect();
      if (!mainRect) {
        return;
      }

      const nextWidth = Math.min(520, Math.max(220, event.clientX - mainRect.left));
      onSidebarWidthChange(nextWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingSidebar, onSidebarWidthChange]);

  return (
    <div className="mdb-layout">
      <header className="mdb-topbar">
        <div className="mdb-topbar-left">
          <div className="mdb-brand-block">
            <div className="mdb-brand">{brand}</div>
            <div className="mdb-window-hint">{windowHint}</div>
          </div>
        </div>
        <div className="mdb-topbar-right">{topbarRight}</div>
      </header>

      <div
        ref={mainRef}
        className={`mdb-main ${isSidebarCollapsed ? "is-sidebar-collapsed" : ""} ${isResizingSidebar ? "is-sidebar-resizing" : ""}`}
        style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
      >
        <button type="button" className="mdb-sidebar-toggle-button" onClick={onToggleSidebar}>
          {isSidebarCollapsed ? "▶" : "◀"}
        </button>
        <aside className={`mdb-sidebar ${isSidebarCollapsed ? "is-hidden" : ""}`}>
          <div className="mdb-sidebar-body">{sidebarContent}</div>
          {sidebarFooter ? <div className="mdb-sidebar-footer">{sidebarFooter}</div> : null}
        </aside>
        {!isSidebarCollapsed ? (
          <div
            className="mdb-sidebar-resizer"
            onMouseDown={(event) => {
              event.preventDefault();
              setIsResizingSidebar(true);
            }}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
          />
        ) : null}

        <main className="mdb-workspace">
          <div className="mdb-workspace-shell" style={{ display: canShowWorkspace ? "flex" : "none" }}>
            {workspace}
          </div>

          {!canShowWorkspace ? emptyState : null}
        </main>
      </div>
    </div>
  );
}