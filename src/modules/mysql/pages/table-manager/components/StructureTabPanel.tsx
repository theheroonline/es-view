/**
 * StructureTabPanel - Table structure management (columns and operations)
 * Shows table columns in a formatted table with edit/delete/move operations
 */

import { useTranslation } from "react-i18next";
import type { ColumnMeta } from "../../../types";
import type { TableInfo } from "../utils";

export interface StructureTabPanelProps {
  /** Selected table information including columns */
  selectedTableInfo: TableInfo | null;
  /** Called when add column button is clicked */
  onAddColumn: () => void;
  /** Called when manage indexes button is clicked */
  onManageIndexes: () => void;
  /** Called when move column up/down button is clicked */
  onMoveColumn: (column: ColumnMeta, direction: "up" | "down") => void;
  /** Called when edit column button is clicked */
  onEditColumn: (column: ColumnMeta) => void;
  /** Called when drop column button is clicked */
  onDropColumn: (column: ColumnMeta) => void;
}

export function StructureTabPanel({
  selectedTableInfo,
  onAddColumn,
  onManageIndexes,
  onMoveColumn,
  onEditColumn,
  onDropColumn
}: StructureTabPanelProps) {
  const { t } = useTranslation();

  if (!selectedTableInfo) return null;

  if (selectedTableInfo.loading) {
    return (
      <div className="workspace-empty-card">
        <span className="muted">{t("common.loading")}</span>
      </div>
    );
  }

  if (!selectedTableInfo.columns) {
    return (
      <div className="workspace-empty-card">
        <span className="muted">{t("common.noData")}</span>
      </div>
    );
  }

  const columns = selectedTableInfo.columns;

  return (
    <div className="table-wrapper">
      <div className="tm-structure-actions">
        <button className="btn btn-sm btn-primary" onClick={onAddColumn}>
          {t("mysql.tableManager.addColumn")}
        </button>
        <button className="btn btn-sm btn-ghost" onClick={onManageIndexes}>
          📑 {t("mysql.tableManager.manageIndexes")}
        </button>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Type</th>
            <th>Null</th>
            <th>Key</th>
            <th>Default</th>
            <th>Extra</th>
            <th className="tm-table-head-actions">{t("dataBrowser.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((col: ColumnMeta, index: number) => (
            <tr key={col.field}>
              <td className={col.key === "PRI" ? "tm-table-field-primary" : undefined}>
                {col.field}
              </td>
              <td>
                <span className="pill">{col.type}</span>
              </td>
              <td>{col.null}</td>
              <td>{col.key && <span className="pill">{col.key}</span>}</td>
              <td className="muted">{col.default ?? "NULL"}</td>
              <td className="muted">{col.extra}</td>
              <td className="tm-actions-cell">
                <div className="tm-actions-row">
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => onMoveColumn(col, "up")}
                    disabled={index === 0}
                  >
                    {t("mysql.tableManager.moveColumnUp")}
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => onMoveColumn(col, "down")}
                    disabled={index === columns.length - 1}
                  >
                    {t("mysql.tableManager.moveColumnDown")}
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => onEditColumn(col)}>
                    {t("mysql.tableManager.editStructure")}
                  </button>
                  <button
                    className="btn btn-sm btn-ghost text-danger"
                    onClick={() => onDropColumn(col)}
                  >
                    {t("mysql.tableManager.dropColumn")}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
