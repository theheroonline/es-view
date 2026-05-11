/**
 * InfoTabPanel - Table information and metadata display
 * Shows detailed table information including engine, size, creation time, etc.
 */

import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import type { TableInfo } from "../utils";
import { formatBytes } from "../utils";

export interface InfoTabPanelProps {
  /** Selected table information */
  selectedTableInfo: TableInfo | null;
}

export function InfoTabPanel({ selectedTableInfo }: InfoTabPanelProps) {
  const { t } = useTranslation();

  if (!selectedTableInfo) return null;

  if (selectedTableInfo.loading) {
    return (
      <div className="workspace-empty-card">
        <span className="muted">{t("common.loading")}</span>
      </div>
    );
  }

  const info = selectedTableInfo.info;
  if (!info) {
    return (
      <div className="workspace-empty-card">
        <span className="muted">{t("common.noData")}</span>
      </div>
    );
  }

  const detailItems = [
    { label: t("mysql.tableManager.tableType"), value: t("mysql.tableManager.baseTable") },
    { label: t("mysql.tableManager.engine"), value: info.engine },
    { label: t("mysql.tableManager.databaseLabel"), value: selectedTableInfo.database },
    { label: t("mysql.tableManager.rowCountLabel"), value: info.tableRows?.toLocaleString() ?? "0" },
    { label: t("mysql.tableManager.autoIncrement"), value: info.autoIncrement },
    { label: t("mysql.tableManager.rowFormat"), value: info.rowFormat },
    { label: t("mysql.tableManager.createTime"), value: info.createTime },
    { label: t("mysql.tableManager.updateTime"), value: info.updateTime },
    { label: t("mysql.tableManager.checkTime"), value: info.checkTime },
    { label: t("mysql.tableManager.collation"), value: info.collation },
    { label: t("mysql.tableManager.indexLength"), value: formatBytes(info.indexLength) },
    { label: t("mysql.tableManager.dataLength"), value: formatBytes(info.dataLength) },
    { label: t("mysql.tableManager.maxDataLength"), value: formatBytes(info.maxDataLength) },
    { label: t("mysql.tableManager.dataFree"), value: formatBytes(info.dataFree) },
    { label: t("mysql.tableManager.avgRowLength"), value: formatBytes(info.avgRowLength) },
    { label: t("mysql.tableManager.createOptions"), value: info.createOptions },
    { label: t("mysql.tableManager.tableComment"), value: info.comment }
  ];

  return (
    <div className="tm-info-pane">
      <div className="tm-info-stack">
        <div className="tm-info-title-block">
          <div className="tm-info-title">{selectedTableInfo.table}</div>
          <div className="muted tm-info-subtitle">{selectedTableInfo.database}</div>
        </div>

        <div className="tm-info-grid">
          {detailItems.map((item) => (
            <Fragment key={item.label}>
              <div className="muted tm-info-label">{item.label}</div>
              <div className="tm-info-value">{item.value}</div>
            </Fragment>
          ))}
        </div>

        <div className="tm-info-section">
          <div className="muted tm-info-label">{t("mysql.tableManager.createSql")}</div>
          <pre className="tm-sql-preview">
            {info.createSql}
          </pre>
        </div>
      </div>
    </div>
  );
}
