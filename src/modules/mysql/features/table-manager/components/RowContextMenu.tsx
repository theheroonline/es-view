import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { RowContextMenu as RowContextMenuState } from "../utils";

interface RowContextMenuProps {
  menu: RowContextMenuState | null;
  style: CSSProperties;
  selectedCellsCount: number;
  selectedRowsCount: number;
  onCopyRows: () => void;
  onCopyInsert: () => void;
  onCopyUpdate: () => void;
  onFilterByValue: () => void;
  onSortAsc: () => void;
  onSortDesc: () => void;
  onSetNull: () => void;
  onSetEmptyString: () => void;
  onBatchEdit: () => void;
  onDelete: () => void;
}

export function RowContextMenu({
  menu,
  style,
  selectedCellsCount,
  selectedRowsCount,
  onCopyRows,
  onCopyInsert,
  onCopyUpdate,
  onFilterByValue,
  onSortAsc,
  onSortDesc,
  onSetNull,
  onSetEmptyString,
  onBatchEdit,
  onDelete,
}: RowContextMenuProps) {
  const { t } = useTranslation();

  if (!menu) return null;

  return (
    <div className="context-menu-panel" style={style}>
      <button type="button" className="btn btn-sm btn-ghost context-menu-button" onClick={onCopyRows} disabled={selectedCellsCount === 0}>
        {t("mysql.tableManager.copySelectedRows")} ({selectedRowsCount})
      </button>
      <button type="button" className="btn btn-sm btn-ghost context-menu-button" onClick={onCopyInsert} disabled={selectedCellsCount === 0}>
        {t("mysql.tableManager.copyAsInsertStatement")}
      </button>
      <button type="button" className="btn btn-sm btn-ghost context-menu-button" onClick={onCopyUpdate} disabled={selectedCellsCount === 0}>
        {t("mysql.tableManager.copyAsUpdateStatement")}
      </button>
      <div className="context-menu-separator" />
      <button type="button" className="btn btn-sm btn-ghost context-menu-button" onClick={onFilterByValue}>
        {t("mysql.tableManager.filterByCurrentValue")}
      </button>
      <button type="button" className="btn btn-sm btn-ghost context-menu-button" onClick={onSortAsc}>
        {t("dataBrowser.sortAscending")}
      </button>
      <button type="button" className="btn btn-sm btn-ghost context-menu-button" onClick={onSortDesc}>
        {t("dataBrowser.sortDescending")}
      </button>
      <div className="context-menu-separator" />
      <button type="button" className="btn btn-sm btn-ghost context-menu-button" onClick={onSetNull}>
        {t("mysql.tableManager.setNull")}
      </button>
      <button type="button" className="btn btn-sm btn-ghost context-menu-button" onClick={onSetEmptyString}>
        {t("mysql.tableManager.setEmptyString")}
      </button>
      <button type="button" className="btn btn-sm btn-ghost context-menu-button" onClick={onBatchEdit} disabled={selectedCellsCount === 0}>
        {t("mysql.tableManager.batchEdit")} ({selectedCellsCount})
      </button>
      <div className="context-menu-separator" />
      <button type="button" className="btn btn-sm btn-ghost context-menu-button text-danger" onClick={onDelete}>
        {t("common.delete")}
      </button>
    </div>
  );
}
