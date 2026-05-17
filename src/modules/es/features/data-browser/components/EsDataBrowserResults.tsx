import type { TFunction } from "i18next";
import { Fragment } from "react";

type SearchRow = {
  _id: string;
  _index: string;
  _source?: Record<string, unknown>;
};

interface EsDataBrowserResultsProps {
  allColumns: string[];
  expandedRows: Set<string>;
  renderCellValue: (value: unknown, truncate?: boolean) => React.ReactNode;
  rows: SearchRow[];
  selectedDocs: Set<string>;
  selectedRowId: string | null;
  selectedRows: SearchRow[];
  t: TFunction;
  viewMode: "table" | "json";
  onCopySelected: () => void;
  onDeleteSelected: () => void;
  onDeleteDoc: (docIndex: string, docId: string) => void;
  onEditDoc: (row: SearchRow) => void;
  onSelectAllRows: (checked: boolean) => void;
  onSelectRow: (id: string) => void;
  onSelectRowHighlight: (id: string | null) => void;
  onSetViewMode: (mode: "table" | "json") => void;
  onToggleRowExpand: (id: string) => void;
  onRowContextMenu: (event: React.MouseEvent, row: SearchRow, field?: string, value?: unknown) => void;
}

export function EsDataBrowserResults({
  allColumns,
  expandedRows,
  renderCellValue,
  rows,
  selectedDocs,
  selectedRowId,
  selectedRows,
  t,
  viewMode,
  onCopySelected,
  onDeleteSelected,
  onDeleteDoc,
  onEditDoc,
  onSelectAllRows,
  onSelectRow,
  onSelectRowHighlight,
  onSetViewMode,
  onToggleRowExpand,
  onRowContextMenu,
}: EsDataBrowserResultsProps) {
  const isAllRowsSelected = rows.length > 0 && rows.every((row) => selectedDocs.has(row._id));

  return (
    <div className="card" style={{ flex: 1, minHeight: "150px", display: "flex", flexDirection: "column", overflow: "visible" }}>
      <div className="card-header" style={{ padding: "8px 12px", gap: "8px", alignItems: "center" }}>
        <h3 className="card-title" style={{ fontSize: "12px" }}>{t("dataBrowser.queryResult")}</h3>
        <div className="flex-gap" style={{ alignItems: "center", gap: "4px" }}>
          <div className="flex-gap" style={{ gap: "4px" }}>
            <button className="btn btn-sm btn-secondary" onClick={onCopySelected} disabled={selectedRows.length === 0}>{t("dataBrowser.copySelected")}</button>
            <button className="btn btn-sm btn-secondary" onClick={onDeleteSelected} disabled={selectedRows.length === 0}>{t("dataBrowser.deleteSelected")}</button>
          </div>
          <div className="flex-gap" style={{ gap: "4px" }}>
            <button className={`btn btn-sm ${viewMode === "table" ? "btn-primary" : "btn-secondary"}`} onClick={() => onSetViewMode("table")}>{t("dataBrowser.table")}</button>
            <button className={`btn btn-sm ${viewMode === "json" ? "btn-primary" : "btn-secondary"}`} onClick={() => onSetViewMode("json")}>{t("dataBrowser.json")}</button>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card-body">
          <p className="muted" style={{ textAlign: "center", margin: "20px 0" }}>{t("common.noData")}</p>
        </div>
      ) : (
        <div className="es-view-content">
          <div className="es-view-pane" data-active={viewMode === "table"}>
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <div>
                <table className="table">
                  <thead>
                    <tr style={{ height: "34px" }}>
                      <th style={{ width: "42px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={isAllRowsSelected}
                          onChange={(event) => onSelectAllRows(event.target.checked)}
                        />
                      </th>
                      <th style={{ width: "50px" }}></th>
                      <th style={{ width: "120px" }}>_id</th>
                      {allColumns.map((column) => (
                        <th key={column}>{column}</th>
                      ))}
                      <th style={{ width: "140px", textAlign: "right" }}>{t("dataBrowser.operation")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const isHighlighted = selectedRowId === row._id;
                      return (
                      <Fragment key={row._id}>
                        <tr
                          style={{ height: "32px", ...(isHighlighted ? { background: "#eff6ff" } : {}) }}
                          className={expandedRows.has(row._id) ? "row-expanded" : ""}
                          onContextMenu={(event) => onRowContextMenu(event, row)}
                          onClick={() => onSelectRowHighlight(isHighlighted ? null : row._id)}
                        >
                          <td style={{ textAlign: "center", background: isHighlighted ? "#eff6ff" : "inherit", padding: "0 8px" }}>
                            <input
                              type="checkbox"
                              checked={selectedDocs.has(row._id)}
                              onChange={() => onSelectRow(row._id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td style={{ textAlign: "center", background: isHighlighted ? "#eff6ff" : "inherit", padding: "0 8px" }}>
                            <button
                              className="btn btn-ghost btn-icon"
                              onClick={() => onToggleRowExpand(row._id)}
                              style={{ fontSize: "10px", padding: "2px 6px" }}
                            >
                              {expandedRows.has(row._id) ? "▼" : "▶"}
                            </button>
                          </td>
                          <td
                            style={{ cursor: "pointer", background: isHighlighted ? "#eff6ff" : "inherit", padding: "0 8px", position: isHighlighted ? "sticky" : undefined, left: isHighlighted ? 0 : undefined, zIndex: isHighlighted ? 5 : undefined, borderLeft: isHighlighted ? "3px solid #3b82f6" : undefined }}
                            onContextMenu={(event) => { event.stopPropagation(); onRowContextMenu(event, row, "_id", row._id); }}
                          >
                            {row._id}
                          </td>
                          {allColumns.map((column) => (
                            <td
                              key={column}
                              style={{ cursor: "pointer", background: isHighlighted ? "#eff6ff" : "inherit", padding: "0 8px" }}
                              onContextMenu={(event) => { event.stopPropagation(); onRowContextMenu(event, row, column, row._source?.[column]); }}
                            >
                              {renderCellValue(row._source?.[column])}
                            </td>
                          ))}
                          <td className="table-actions" style={{ textAlign: "right", background: isHighlighted ? "#eff6ff" : "inherit", padding: "0 8px" }}>
                            <div className="flex-gap justify-end" style={{ gap: "4px" }}>
                              <button className="btn btn-sm btn-ghost" onClick={() => onEditDoc(row)}>{t("common.edit")}</button>
                              <button className="btn btn-sm btn-ghost text-danger" onClick={() => onDeleteDoc(row._index, row._id)}>{t("common.delete")}</button>
                            </div>
                          </td>
                        </tr>
                        {expandedRows.has(row._id) && (
                          <tr className="expanded-row">
                            <td colSpan={allColumns.length + 4} style={{ background: "#f8fafc", padding: "8px 12px" }}>
                              <pre style={{ margin: 0, fontSize: "12px", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                                {JSON.stringify(row._source, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="es-view-pane" data-active={viewMode === "json"}>
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <div style={{
                padding: "8px 12px",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: "8px",
                marginBottom: "8px",
                fontSize: "13px",
                color: "#1e40af"
              }}>
                💡 {t("dataBrowser.jsonViewTip")}
              </div>
              <div>
                <table className="table">
                  <thead>
                    <tr style={{ height: "34px" }}>
                      <th style={{ width: "120px" }}>{t("dataBrowser.id")}</th>
                      <th>{t("dataBrowser.sourceJson")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row._id} style={{ height: "32px" }}>
                        <td style={{ padding: "0 8px" }}>{row._id}</td>
                        <td>
                          <pre style={{ margin: 0, fontSize: "12px" }}>{JSON.stringify(row._source, null, 2)}</pre>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
