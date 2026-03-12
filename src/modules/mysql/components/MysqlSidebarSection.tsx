import type { MouseEvent, ReactNode } from "react";
import type { ConnectionProfile } from "../../../lib/types";

interface MysqlSidebarSectionProps {
  expanded: boolean;
  profiles: ConnectionProfile[];
  activeConnectionId: string | null | undefined;
  databases: string[];
  expandedDatabase: string | null;
  selectedDatabase?: string;
  selectedTable?: string;
  sidebarExpandedTablesDatabase: string | null;
  tablesByDb: Record<string, string[]>;
  tablesLabel: string;
  emptyText: string;
  noTablesText: string;
  createConnectionTitle: string;
  refreshTitle: string;
  renderConnectionItem: (profile: ConnectionProfile) => ReactNode;
  onToggle: () => void;
  onCreateConnection: () => void;
  onRefresh: () => void;
  onSelectDatabase: (database: string) => void;
  onOpenDatabase: (database: string) => void;
  onDatabaseContextMenu: (event: MouseEvent<HTMLDivElement>, database: string) => void;
  onToggleSidebarTables: (database: string) => void;
  onSelectSidebarTable: (database: string, table: string) => void;
  onOpenSidebarTable: (database: string, table: string) => void;
  onTableContextMenu: (event: MouseEvent<HTMLDivElement>, database: string, table: string) => void;
}

export default function MysqlSidebarSection({
  expanded,
  profiles,
  activeConnectionId,
  databases,
  expandedDatabase,
  selectedDatabase,
  selectedTable,
  sidebarExpandedTablesDatabase,
  tablesByDb,
  tablesLabel,
  emptyText,
  noTablesText,
  createConnectionTitle,
  refreshTitle,
  renderConnectionItem,
  onToggle,
  onCreateConnection,
  onRefresh,
  onSelectDatabase,
  onOpenDatabase,
  onDatabaseContextMenu,
  onToggleSidebarTables,
  onSelectSidebarTable,
  onOpenSidebarTable,
  onTableContextMenu,
}: MysqlSidebarSectionProps) {
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

            return (
              <div key={profile.id}>
                {renderConnectionItem(profile)}
                {isActiveMysql && databases.length > 0 ? (
                  <div className="mdb-tree-nested">
                    {databases.map((database) => {
                      const isOpened = expandedDatabase === database;
                      const isSelected = selectedDatabase === database;
                      const showChildren = isOpened || isSelected;
                      const tablesVisible = sidebarExpandedTablesDatabase === database;
                      const tables = tablesByDb[database] ?? [];
                      const tableCount = tablesByDb[database]?.length;

                      return (
                        <div key={`${profile.id}-${database}`}>
                          <div
                            className={`mdb-tree-item mdb-tree-item-compact mdb-tree-item-between ${isSelected ? "is-selected" : ""}`}
                            onClick={() => onSelectDatabase(database)}
                            onDoubleClick={() => onOpenDatabase(database)}
                            onContextMenu={(event) => onDatabaseContextMenu(event, database)}
                          >
                            <span className="mdb-tree-row-main">
                              <span>{showChildren ? "▾" : "▸"}</span>
                              <span className={`mdb-status-dot ${isOpened ? "status-success" : "status-idle"}`} />
                              <span className="mdb-tree-row-label">{database}</span>
                            </span>
                            <span className="muted mdb-tree-count">{typeof tableCount === "number" ? tableCount : ""}</span>
                          </div>

                          {showChildren ? (
                            <div className="mdb-tree-nested">
                              <div
                                className={`mdb-tree-item mdb-tree-item-compact mdb-tree-item-between ${tablesVisible ? "is-soft-selected" : ""}`}
                                onClick={() => onToggleSidebarTables(database)}
                              >
                                <span className="mdb-tree-row-main">
                                  <span>{tablesVisible ? "▾" : "▸"}</span>
                                  <span>🗂</span>
                                  <span>{tablesLabel}</span>
                                </span>
                                <span className="muted mdb-tree-count">{typeof tableCount === "number" ? tableCount : ""}</span>
                              </div>

                              {tablesVisible ? (
                                <div className="mdb-tree-nested mdb-tree-nested-deep">
                                  {tables.map((table) => (
                                    <div
                                      key={`${profile.id}-${database}-${table}`}
                                      className={`mdb-tree-item mdb-tree-item-compact ${selectedDatabase === database && selectedTable === table ? "is-selected" : ""}`}
                                      onClick={() => onSelectSidebarTable(database, table)}
                                      onDoubleClick={() => onOpenSidebarTable(database, table)}
                                      onContextMenu={(event) => onTableContextMenu(event, database, table)}
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