/**
 * DatabaseOverviewPanel - Database overview with table list and actions
 * Shows all tables in a database with operations (browse, create, refresh)
 */

import { type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import type { CreateTableModalState } from "../utils";

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
  /** Called when a table is double-clicked to browse */
  onBrowseTable: (database: string, table: string) => void;
  /** Called when table context menu is triggered */
  onTableContextMenu: (event: MouseEvent<HTMLDivElement>, database: string, table: string) => void;
  /** Called when refresh tables button is clicked */
  onRefreshTables: (database: string) => void;
  /** Called when create table button is clicked */
  onCreateTableClick: (modalState: CreateTableModalState, editingRows: any[]) => void;
}

export function DatabaseOverviewPanel({
  expandedDatabase,
  tables,
  selectedTable,
  selectedOverviewTables,
  loading,
  onTableClick,
  onBrowseTable,
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
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => onRefreshTables(expandedDatabase)}
            disabled={loading}
          >
            {t("mysql.tableManager.refreshTables")}
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => {
              onCreateTableClick(
                {
                  database: expandedDatabase,
                  tableName: "",
                  columns: [],
                  charset: "utf8mb4",
                  engine: "InnoDB"
                },
                [
                  {
                    id: Date.now().toString(),
                    name: "",
                    type: "varchar",
                    length: "255",
                    scale: "",
                    nullable: true,
                    defaultValue: "",
                    isPrimary: false,
                    autoIncrement: false,
                    comment: "",
                    timestampDefault: "none",
                    timestampOnUpdate: false,
                    extraAttributes: ""
                  }
                ]
              );
            }}
          >
            {t("mysql.tableManager.createTable")}
          </button>
        </div>
      </div>

      <div className="tm-overview-content">
        {tables.length > 0 ? (
          <div className="mysql-table-grid">
            {tables.map((table) => (
              <div
                key={table}
                className={`mysql-table-card ${selectedTableSet.has(table) ? "selected" : ""} ${
                  selectedTable === table ? "active" : ""
                }`}
                onClick={(event) => onTableClick(event, expandedDatabase, table)}
                onDoubleClick={() => {
                  onBrowseTable(expandedDatabase, table);
                }}
                onContextMenu={(event) => onTableContextMenu(event, expandedDatabase, table)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onBrowseTable(expandedDatabase, table);
                  }
                }}
              >
                <div className="mysql-table-card-name" title={table}>
                  {table}
                </div>
              </div>
            ))}
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
