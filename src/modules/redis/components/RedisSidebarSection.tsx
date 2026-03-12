import type { ReactNode } from "react";

interface RedisSidebarSectionProps {
  expanded: boolean;
  onToggle: () => void;
  onCreateConnection: () => void;
  emptyText: string;
  createConnectionTitle: string;
  hasConnections: boolean;
  children: ReactNode;
}

export default function RedisSidebarSection({
  expanded,
  onToggle,
  onCreateConnection,
  emptyText,
  createConnectionTitle,
  hasConnections,
  children,
}: RedisSidebarSectionProps) {
  return (
    <div className="mdb-tree-group mdb-tree-group-spaced">
      <div className="mdb-tree-label mdb-tree-header">
        <button type="button" className="btn btn-sm btn-ghost mdb-tree-toggle" onClick={onToggle}>
          <span>{expanded ? "▾" : "▸"}</span>
          <span>Redis</span>
        </button>
        <button type="button" className="btn btn-sm btn-ghost mdb-tree-action" onClick={onCreateConnection} title={createConnectionTitle}>
          +
        </button>
      </div>

      {expanded && (
        <div className="mdb-tree-items mdb-tree-stack">
          {children}
          {!hasConnections ? <div className="mdb-tree-empty">{emptyText}</div> : null}
        </div>
      )}
    </div>
  );
}