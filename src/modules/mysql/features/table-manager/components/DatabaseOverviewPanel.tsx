/**
 * DatabaseOverviewPanel - Database overview with table list and actions
 * Shows all tables in a database with operations (browse, create, refresh)
 */

import { type MouseEvent } from "react";
import { useTranslation } from "react-i18next";

export interface DatabaseOverviewPanelProps {
  /** Currently expanded database name */
  expandedDatabase: string | null;
  /** Tables for the expanded database */
  tables: string[];
  /** Currently selected table in overview */
  selectedTable?: string | null;
  /** Tables selected for batch operations */
  selectedOverviewTables: string[];
  /** Whether data is loading */
  loading: boolean;
  /** Called when a table is clicked in the overview */
  onTableClick: (event: MouseEvent<HTMLDivElement>, database: string, table: string) => void;
  /** Called when selected overview tables should be cleared */
  onClearSelection: () => void;
  /** Called when a table is double-clicked to browse */
  onBrowseTable: (database: string, table: string) => void;
  /** Called when a table drag operation starts */
  onTableDragStart: (event: React.DragEvent<HTMLDivElement>, database: string, table: string) => void;
  /** Called when table context menu is triggered */
  onTableContextMenu: (event: MouseEvent<HTMLDivElement>, database: string, table: string) => void;
  /** Called when refresh tables button is clicked */
  onRefreshTables: (database: string) => void;
  /** Called when create table button is clicked */
  onCreateTableClick: () => void;
}

export function DatabaseOverviewPanel({
  expandedDatabase,
  tables,
  selectedTable,
  selectedOverviewTables,
  loading,
  onTableClick,
  onClearSelection,
  onBrowseTable,
  onTableDragStart,
  onTableContextMenu,
  onRefreshTables,
  onCreateTableClick
}: DatabaseOverviewPanelProps) {
  const { t } = useTranslation();

  if (!expandedDatabase) {
    return (
      <div className="workspace-center-state">
        <span className="muted">{t("mysql.tableManager.openDatabaseHint")}</span>
      </div>
    );
  }

  const selectedTableSet = new Set(selectedOverviewTables);

  return (
    <>
      <div className="card-header page-section-header">
        <div>
          <h3 className="card-title">{expandedDatabase}</h3>
          <p className="muted tm-overview-header-note">
            {t("mysql.tableManager.tableCount", { count: tables.length })}
          </p>
        </div>
        <div className="tm-overview-actions">
          {selectedOverviewTables.length > 0 ? (
            <button className="btn btn-sm btn-ghost" onClick={onClearSelection}>
              {t("mysql.tableManager.clearTableSelection")}
            </button>
          ) : null}
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => onRefreshTables(expandedDatabase)}
            disabled={loading}
          >
            {t("mysql.tableManager.refreshTables")}
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={onCreateTableClick}
          >
            {t("mysql.tableManager.createTable")}
          </button>
        </div>
      </div>

      <div className="tm-overview-content">
        {tables.length > 0 ? (
          <div className="tm-overview-shell">
            <div className="tm-overview-list">
              {tables.map((table) => (
                <div
                  key={table}
                  className={`mdb-tree-item mdb-tree-item-compact tm-overview-list-item ${selectedTableSet.has(table) ? "is-soft-selected" : ""} ${selectedTable === table ? "is-selected" : ""}`}
                  draggable
                  onClick={(event) => onTableClick(event, expandedDatabase, table)}
                  onDoubleClick={() => {
                    onBrowseTable(expandedDatabase, table);
                  }}
                  onContextMenu={(event) => onTableContextMenu(event, expandedDatabase, table)}
                  onDragStart={(event) => onTableDragStart(event, expandedDatabase, table)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onBrowseTable(expandedDatabase, table);
                    }
                  }}
                >
                  <span className="mdb-tree-row-main">
                    <span className="mdb-tree-table-icon">▤</span>
                    <span className="mdb-tree-row-label" title={table}>{table}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card workspace-empty-card">
            <span className="muted">{t("mysql.data.noTables")}</span>
          </div>
        )}
      </div>
    </>
  );
}
