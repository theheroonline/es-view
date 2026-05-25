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
  selectedRows: SearchRow[];
  t: TFunction;
  viewMode: "table" | "json";
  onCopySelected: () => void;
  onDeleteSelected: () => void;
  onDeleteDoc: (docIndex: string, docId: string) => void;
  onEditDoc: (row: SearchRow) => void;
  onSelectAllRows: (checked: boolean) => void;
  onSelectRow: (id: string) => void;
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
  selectedRows,
  t,
  viewMode,
  onCopySelected,
  onDeleteSelected,
  onDeleteDoc,
  onEditDoc,
  onSelectAllRows,
  onSelectRow,
  onSetViewMode,
  onToggleRowExpand,
  onRowContextMenu,
}: EsDataBrowserResultsProps) {
  const isAllRowsSelected = rows.length > 0 && selectedDocs.size === rows.length;

  return (
    <div className="card" style={{ flex: 1, minHeight: "200px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div className="card-header">
        <h3 className="card-title">{t("dataBrowser.queryResult")}</h3>
        <div className="flex-gap" style={{ alignItems: "center" }}>
          <div className="flex-gap" style={{ gap: "4px" }}>
            <button className="btn btn-sm btn-secondary" onClick={onCopySelected} disabled={selectedRows.length === 0}>{t("dataBrowser.copySelected")}</button>
            <button className="btn btn-sm btn-secondary" onClick={onDeleteSelected} disabled={selectedRows.length === 0}>{t("dataBrowser.deleteSelected")}</button>
          </div>
          <div className="flex-gap">
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
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {viewMode === "table" && (
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
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
                    {rows.map((row) => (
                      <Fragment key={row._id}>
                        <tr onContextMenu={(event) => onRowContextMenu(event, row)} className={expandedRows.has(row._id) ? "row-expanded" : ""}>
                          <td style={{ textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={selectedDocs.has(row._id)}
                              onChange={() => onSelectRow(row._id)}
                            />
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              className="btn btn-ghost btn-icon"
                              onClick={() => onToggleRowExpand(row._id)}
                              style={{ fontSize: "10px", padding: "2px 6px" }}
                            >
                              {expandedRows.has(row._id) ? "▼" : "▶"}
                            </button>
                          </td>
                          <td onContextMenu={(event) => { event.stopPropagation(); onRowContextMenu(event, row, "_id", row._id); }}>{row._id}</td>
                          {allColumns.map((column) => (
                            <td
                              key={column}
                              onContextMenu={(event) => { event.stopPropagation(); onRowContextMenu(event, row, column, row._source?.[column]); }}
                            >
                              {renderCellValue(row._source?.[column])}
                            </td>
                          ))}
                          <td className="table-actions" style={{ textAlign: "right" }}>
                            <div className="flex-gap justify-end" style={{ gap: "4px" }}>
                              <button className="btn btn-sm btn-ghost" onClick={() => onEditDoc(row)}>{t("common.edit")}</button>
                              <button className="btn btn-sm btn-ghost text-danger" onClick={() => onDeleteDoc(row._index, row._id)}>{t("common.delete")}</button>
                            </div>
                          </td>
                        </tr>
                        {expandedRows.has(row._id) && (
                          <tr className="expanded-row">
                            <td colSpan={allColumns.length + 4} style={{ background: "#f8fafc", padding: "12px 16px" }}>
                              <pre style={{ margin: 0, fontSize: "12px", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                                {JSON.stringify(row._source, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {viewMode === "json" && (
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <div style={{
                padding: "12px 16px",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: "8px",
                marginBottom: "12px",
                fontSize: "13px",
                color: "#1e40af"
              }}>
                💡 {t("dataBrowser.jsonViewTip")}
              </div>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: "120px" }}>{t("dataBrowser.id")}</th>
                      <th>{t("dataBrowser.sourceJson")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row._id}>
                        <td>{row._id}</td>
                        <td>
                          <pre style={{ margin: 0, fontSize: "12px" }}>{JSON.stringify(row._source, null, 2)}</pre>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
