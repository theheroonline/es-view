import { useTranslation } from "react-i18next";
import type { TableInfo } from "../utils";

export interface StructureOverviewPanelProps {
  selectedTableInfo: TableInfo | null;
}

export function StructureOverviewPanel({ selectedTableInfo }: StructureOverviewPanelProps) {
  const { t } = useTranslation();

  if (!selectedTableInfo) return null;

  if (selectedTableInfo.loading) {
    return (
      <div className="workspace-empty-card">
        <span className="muted">{t("common.loading")}</span>
      </div>
    );
  }

  const columns = selectedTableInfo.columns;
  if (!columns || columns.length === 0) {
    return (
      <div className="workspace-empty-card">
        <span className="muted">{t("common.noData")}</span>
      </div>
    );
  }

  return (
    <div className="tm-structure-overview">
      <table className="table">
        <thead>
          <tr>
            <th>{t("mysql.tableManager.columnField")}</th>
            <th>{t("mysql.tableManager.columnType")}</th>
            <th>{t("mysql.tableManager.columnNull")}</th>
            <th>{t("mysql.tableManager.columnKey")}</th>
            <th>{t("mysql.tableManager.columnDefault")}</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((col) => (
            <tr key={col.field}>
              <td className={col.key === "PRI" ? "tm-overview-field-primary" : undefined}>
                {col.field}
              </td>
              <td>
                <span className="pill">{col.type}</span>
              </td>
              <td>{col.null}</td>
              <td>{col.key && <span className="pill">{col.key}</span>}</td>
              <td className="muted">{col.default ?? "NULL"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
