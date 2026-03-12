import type { ReactNode } from "react";

interface WorkspaceChromeProps {
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
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
  brand,
  windowHint,
  topbarRight,
  sidebarContent,
  sidebarFooter,
  workspace,
  emptyState,
  canShowWorkspace,
}: WorkspaceChromeProps) {
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

      <div className={`mdb-main ${isSidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
        <button type="button" className="mdb-sidebar-toggle-button" onClick={onToggleSidebar}>
          {isSidebarCollapsed ? "▶" : "◀"}
        </button>
        <aside className={`mdb-sidebar ${isSidebarCollapsed ? "is-hidden" : ""}`}>
          <div className="mdb-sidebar-body">{sidebarContent}</div>
          {sidebarFooter ? <div className="mdb-sidebar-footer">{sidebarFooter}</div> : null}
        </aside>

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