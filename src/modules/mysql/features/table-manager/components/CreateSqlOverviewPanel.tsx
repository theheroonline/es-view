import { useTranslation } from "react-i18next";
import type { TableInfo } from "../utils";

export interface CreateSqlOverviewPanelProps {
  selectedTableInfo: TableInfo | null;
}

export function CreateSqlOverviewPanel({ selectedTableInfo }: CreateSqlOverviewPanelProps) {
  const { t } = useTranslation();

  if (!selectedTableInfo) return null;

  if (selectedTableInfo.loading) {
    return (
      <div className="workspace-empty-card">
        <span className="muted">{t("common.loading")}</span>
      </div>
    );
  }

  const sql = selectedTableInfo.info?.createSql;
  if (!sql) {
    return (
      <div className="workspace-empty-card">
        <span className="muted">{t("common.noData")}</span>
      </div>
    );
  }

  return (
    <div className="tm-create-sql-overview">
      <pre className="tm-create-sql-code">{sql}</pre>
    </div>
  );
}
