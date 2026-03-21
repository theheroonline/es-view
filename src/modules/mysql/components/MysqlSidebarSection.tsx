import { useState, type MouseEvent, type ReactNode } from "react";
import type { ConnectionProfile } from "../../../lib/types";

interface MysqlSidebarSectionProps {
  expanded: boolean;
  profiles: ConnectionProfile[];
  activeConnectionId: string | null | undefined;
  databases: string[];
  expandedSidebarTablesDatabases: string[];
  selectedSidebarTables: string[];
  selectedDatabase?: string;
  selectedTable?: string;
  tablesByDb: Record<string, string[]>;
  emptyText: string;
  noTablesText: string;
  createConnectionTitle: string;
  refreshTitle: string;
  renderConnectionItem: (profile: ConnectionProfile) => ReactNode;
  onToggle: () => void;
  onCreateConnection: () => void;
  onRefresh: () => void;
  onOpenDatabase: (database: string) => void;
  onDatabaseContextMenu: (event: MouseEvent<HTMLDivElement>, database: string) => void;
  onToggleSidebarTables: (database: string) => void;
  onSelectSidebarTable: (event: MouseEvent<HTMLDivElement>, database: string, table: string) => void;
  onOpenSidebarTable: (database: string, table: string) => void;
  onTableContextMenu: (event: MouseEvent<HTMLDivElement>, database: string, table: string) => void;
  onSidebarTableDragStart: (event: React.DragEvent<HTMLDivElement>, database: string, table: string) => void;
  onSidebarDatabaseDrop: (event: React.DragEvent<HTMLDivElement>, database: string) => void;
}

export default function MysqlSidebarSection({
  expanded,
  profiles,
  activeConnectionId,
  databases,
  expandedSidebarTablesDatabases,
  selectedSidebarTables,
  selectedDatabase,
  selectedTable,
  tablesByDb,
  emptyText,
  noTablesText,
  createConnectionTitle,
  refreshTitle,
  renderConnectionItem,
  onToggle,
  onCreateConnection,
  onRefresh,
  onOpenDatabase,
  onDatabaseContextMenu,
  onToggleSidebarTables,
  onSelectSidebarTable,
  onOpenSidebarTable,
  onTableContextMenu,
  onSidebarTableDragStart,
  onSidebarDatabaseDrop,
}: MysqlSidebarSectionProps) {
  const selectedSidebarTableSet = new Set(selectedSidebarTables);
  const [collapsedConnectionIds, setCollapsedConnectionIds] = useState<Record<string, boolean>>({});

  const toggleConnectionCollapse = (connectionId: string) => {
    setCollapsedConnectionIds((prev) => ({
      ...prev,
      [connectionId]: !prev[connectionId],
    }));
  };

  return (
    <div className="mdb-tree-group mdb-tree-group-spaced">
      <div className="mdb-tree-label mdb-tree-header">
        <button type="button" className="btn btn-sm btn-ghost mdb-tree-toggle" onClick={onToggle}>
          <span>{expanded ? "▾" : "▸"}</span>
          <span>MySQL</span>
        </button>
        <button type="button" className="btn btn-sm btn-ghost mdb-tree-action" onClick={onCreateConnection} title={createConnectionTitle}>
          +
        </button>
        <button type="button" className="btn btn-sm btn-ghost mdb-tree-action" onClick={onRefresh} title={refreshTitle}>
          ↻
        </button>
      </div>

      {expanded && (
        <div className="mdb-tree-items mdb-tree-stack">
          {profiles.map((profile) => {
            const isActiveMysql = activeConnectionId === profile.id && profile.engine === "mysql";
            const isConnectionCollapsed = collapsedConnectionIds[profile.id] ?? false;

            return (
              <div key={profile.id}>
                <div
                  onClick={() => {
                    if (isActiveMysql) {
                      toggleConnectionCollapse(profile.id);
                    }
                  }}
                >
                  {renderConnectionItem(profile)}
                </div>
                {isActiveMysql && !isConnectionCollapsed && databases.length > 0 ? (
                  <div className="mdb-tree-nested">
                    {databases.map((database) => {
                      const isOpened = expandedSidebarTablesDatabases.includes(database);
                      const isSelected = selectedDatabase === database;
                      const tables = tablesByDb[database] ?? [];
                      const tableCount = tablesByDb[database]?.length;

                      return (
                        <div key={`${profile.id}-${database}`}>
                          <div
                            className={`mdb-tree-item mdb-tree-item-compact mdb-tree-item-between ${isSelected ? "is-selected" : ""}`}
                            onClick={() => {
                              if (isSelected) {
                                void onToggleSidebarTables(database);
                                return;
                              }

                              void onOpenDatabase(database);
                            }}
                            onContextMenu={(event) => onDatabaseContextMenu(event, database)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => onSidebarDatabaseDrop(event, database)}
                          >
                            <span className="mdb-tree-row-main">
                              <span
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void onToggleSidebarTables(database);
                                }}
                                style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", width: "20px" }}
                                title="Click to expand/collapse"
                              >
                                {isOpened ? "▾" : "▸"}
                              </span>
                              <span className={`mdb-status-dot ${isOpened ? "status-success" : "status-idle"}`} />
                              <span
                                className="mdb-tree-row-label"
                                onDoubleClick={(event) => {
                                  event.stopPropagation();
                                  void onToggleSidebarTables(database);
                                }}
                                style={{ cursor: "pointer", flex: 1 }}
                              >
                                {database}
                              </span>
                            </span>
                            <span className="muted mdb-tree-count">{typeof tableCount === "number" ? tableCount : ""}</span>
                          </div>

                          {isOpened ? (
                            <div className="mdb-tree-nested mdb-tree-nested-deep">
                              {tables.map((table) => (
                                <div
                                  key={`${profile.id}-${database}-${table}`}
                                  className={`mdb-tree-item mdb-tree-item-compact ${selectedDatabase === database && selectedSidebarTableSet.has(table) ? "is-soft-selected" : ""} ${selectedDatabase === database && selectedTable === table ? "is-selected" : ""}`}
                                  draggable
                                  onClick={(event) => onSelectSidebarTable(event, database, table)}
                                  onDoubleClick={() => onOpenSidebarTable(database, table)}
                                  onContextMenu={(event) => onTableContextMenu(event, database, table)}
                                  onDragStart={(event) => onSidebarTableDragStart(event, database, table)}
                                  title={table}
                                >
                                  <span className="mdb-tree-row-main">
                                    <span className="mdb-tree-table-icon">▤</span>
                                    <span className="mdb-tree-row-label">{table}</span>
                                  </span>
                                </div>
                              ))}
                              {tables.length === 0 ? <div className="mdb-tree-empty">{noTablesText}</div> : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
          {profiles.length === 0 ? <div className="mdb-tree-empty">{emptyText}</div> : null}
        </div>
      )}
    </div>
  );
}