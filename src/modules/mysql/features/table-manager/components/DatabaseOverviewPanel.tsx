/**
 * DatabaseOverviewPanel - Database overview with table list and actions
 * Shows all tables in a database with operations (browse, create, refresh)
 * Split layout: left = table list, right = selected table detail (overview/structure)
 */

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import type { TableInfo, TableDetailInfo } from "../types";
import { InfoTabPanel } from "./InfoTabPanel";
import { StructureOverviewPanel } from "./StructureOverviewPanel";
import { CreateSqlOverviewPanel } from "./CreateSqlOverviewPanel";
import { fetchTableDetailSnapshot } from "../services/tableSchemaService";
import { escapeSqlLiteral, formatInfoText, formatInfoDate, toSafeNumber } from "../utils";

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
  /** Connection ID for loading table detail */
  connectionId?: string;
  /** Called when a table is clicked in the overview */
  onTableClick: (event: MouseEvent<HTMLDivElement>, database: string, table: string) => void;
  /** Called when a table is double-clicked to browse */
  onBrowseTable: (database: string, table: string) => void;
  /** Called when a table drag operation starts */
  onDragStart: (event: React.DragEvent<HTMLDivElement>, database: string, table: string) => void;
  /** Called when table context menu is triggered */
  onTableContextMenu: (event: MouseEvent<HTMLDivElement>, database: string, table: string) => void;
  /** Called when refresh tables button is clicked */
  onRefreshTables: (database: string) => void;
  /** Called when create table button is clicked */
  onCreateTableClick: () => void;
}

function getSingleResultRow(columns: string[], rows: unknown[][]): Record<string, unknown> | null {
  if (!columns || !rows || rows.length === 0) return null;
  const row = rows[0];
  const result: Record<string, unknown> = {};
  columns.forEach((col, i) => {
    result[col] = row[i] ?? null;
  });
  return result;
}

export function DatabaseOverviewPanel({
  expandedDatabase,
  tables,
  selectedTable,
  selectedOverviewTables,
  loading,
  connectionId,
  onTableClick,
  onBrowseTable,
  onDragStart,
  onTableContextMenu,
  onRefreshTables,
  onCreateTableClick
}: DatabaseOverviewPanelProps) {
  const { t } = useTranslation();
  const [tableDetailInfo, setTableDetailInfo] = useState<TableInfo | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "structure" | "createSql">("overview");
  const [detailWidth, setDetailWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (event: globalThis.MouseEvent) => {
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;

      const newWidth = Math.min(600, Math.max(220, containerRect.right - event.clientX));
      setDetailWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const loadTableDetail = useCallback(async (db: string, table: string, connId: string) => {
    const escaped = escapeSqlLiteral(table);
    setTableDetailInfo({ database: db, table, loading: true });
    try {
      const { columns, countResult, statusResult, createResult } = await fetchTableDetailSnapshot(
        connId, db, table, escaped
      );

      const rowCount = countResult.isResultSet && countResult.rows.length > 0
        ? Number(countResult.rows[0][0]) || 0
        : 0;

      const statusRow = getSingleResultRow(statusResult.columns, statusResult.rows);
      const createTableRow = getSingleResultRow(createResult.columns, createResult.rows);
      const info: TableDetailInfo = {
        engine: formatInfoText(statusRow?.Engine),
        rowFormat: formatInfoText(statusRow?.Row_format),
        tableRows: toSafeNumber(statusRow?.Rows),
        autoIncrement: formatInfoText(statusRow?.Auto_increment),
        createTime: formatInfoDate(statusRow?.Create_time),
        updateTime: formatInfoDate(statusRow?.Update_time),
        checkTime: formatInfoDate(statusRow?.Check_time),
        collation: formatInfoText(statusRow?.Collation),
        indexLength: toSafeNumber(statusRow?.Index_length),
        dataLength: toSafeNumber(statusRow?.Data_length),
        maxDataLength: toSafeNumber(statusRow?.Max_data_length),
        dataFree: toSafeNumber(statusRow?.Data_free),
        avgRowLength: toSafeNumber(statusRow?.Avg_row_length),
        comment: formatInfoText(statusRow?.Comment),
        createOptions: formatInfoText(statusRow?.Create_options),
        createSql: formatInfoText(createTableRow?.["Create Table"])
      };

      setTableDetailInfo({ database: db, table, columns, rowCount, info, loading: false });
    } catch {
      setTableDetailInfo({ database: db, table, loading: false });
    }
  }, []);

  useEffect(() => {
    if (!showDetail || !expandedDatabase || !selectedTable || !connectionId) {
      setTableDetailInfo(null);
      return;
    }
    void loadTableDetail(expandedDatabase, selectedTable, connectionId);
  }, [showDetail, expandedDatabase, selectedTable, connectionId, loadTableDetail]);

  if (!expandedDatabase) {
    return (
      <div className="workspace-center-state">
        <span className="muted">{t("mysql.tableManager.openDatabaseHint")}</span>
      </div>
    );
  }

  const selectedTableSet = new Set(selectedOverviewTables);

  return (
    <div className="db-overview-split" ref={containerRef}>
      {/* Left: Table list */}
      <div className="db-overview-list-side">
        <div className="card-header page-section-header db-overview-header">
          <div>
            <h3 className="card-title">{expandedDatabase}</h3>
            <p className="muted tm-overview-header-note">
              {t("mysql.tableManager.tableCount", { count: tables.length })}
            </p>
          </div>
          <div className="tm-overview-actions">
            <button
              className="btn btn-sm btn-primary"
              onClick={onCreateTableClick}
            >
              {t("mysql.tableManager.createTable")}
            </button>
            <button
              className={`btn btn-sm ${showDetail ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setShowDetail((prev) => !prev)}
            >
              {t("mysql.tableManager.info")}
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => onRefreshTables(expandedDatabase)}
              disabled={loading}
            >
              {t("mysql.tableManager.refreshTables")}
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
                    onDragStart={(event) => onDragStart(event, expandedDatabase, table)}
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
      </div>

      {showDetail && (
        <>
          {/* Resizer handle */}
          <div
            className="db-overview-resizer"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizing(true);
            }}
          />

          {/* Right: Table detail */}
          <div className="db-overview-detail-side" style={{ width: detailWidth, flexShrink: 0 }}>
            {!selectedTable ? (
              <div className="workspace-center-state">
                <span className="muted">{t("mysql.tableManager.selectTableHint")}</span>
              </div>
            ) : (
              <>
                <div className="tm-detail-toolbar">
                  <div className="tm-detail-tab-buttons">
                    <button
                      className={`btn btn-xs tm-detail-tab-button ${detailTab === "overview" ? "is-active" : ""}`}
                      onClick={() => setDetailTab("overview")}
                    >
                      {t("mysql.tableManager.overview")}
                    </button>
                    <button
                      className={`btn btn-xs tm-detail-tab-button ${detailTab === "structure" ? "is-active" : ""}`}
                      onClick={() => setDetailTab("structure")}
                    >
                      {t("mysql.tableManager.structure")}
                    </button>
                    <button
                      className={`btn btn-xs tm-detail-tab-button ${detailTab === "createSql" ? "is-active" : ""}`}
                      onClick={() => setDetailTab("createSql")}
                    >
                      {t("mysql.tableManager.createSql")}
                    </button>
                  </div>
                </div>
                <div className="tm-detail-content">
                  <div className="tm-detail-pane" data-active={detailTab === "overview"}>
                    <InfoTabPanel selectedTableInfo={tableDetailInfo} />
                  </div>
                  <div className="tm-detail-pane" data-active={detailTab === "structure"}>
                    <StructureOverviewPanel selectedTableInfo={tableDetailInfo} />
                  </div>
                  <div className="tm-detail-pane" data-active={detailTab === "createSql"}>
                    <CreateSqlOverviewPanel selectedTableInfo={tableDetailInfo} />
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
