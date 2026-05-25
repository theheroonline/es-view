import { useTranslation } from "react-i18next";

interface SqlResultContextMenuProps {
  menu: { x: number; y: number; rowIndex: number; columnIndex: number; column: string; value: unknown } | null;
  selectedCellsCount: number;
  selectedRowsCount: number;
  onCopyRows: () => void;
  onCopyInsert: () => void;
  onCopyUpdate: () => void;
  onFilterByValue: () => void;
  onSortAsc: () => void;
  onSortDesc: () => void;
}

export function SqlResultContextMenu({
  menu,
  selectedCellsCount,
  selectedRowsCount,
  onCopyRows,
  onCopyInsert,
  onCopyUpdate,
  onFilterByValue,
  onSortAsc,
  onSortDesc,
}: SqlResultContextMenuProps) {
  const { t } = useTranslation();

  if (!menu) return null;

  return (
    <div
      className="context-menu-panel"
      style={{
        position: "fixed",
        left: `${menu.x}px`,
        top: `${menu.y}px`,
        zIndex: 9999,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="btn btn-sm btn-ghost context-menu-button"
        onClick={onCopyRows}
        disabled={selectedCellsCount === 0}
      >
        {t("mysql.tableManager.copySelectedRows")} ({selectedRowsCount})
      </button>
      <button
        type="button"
        className="btn btn-sm btn-ghost context-menu-button"
        onClick={onCopyInsert}
        disabled={selectedCellsCount === 0}
      >
        {t("mysql.tableManager.copyAsInsertStatement")}
      </button>
      <button
        type="button"
        className="btn btn-sm btn-ghost context-menu-button"
        onClick={onCopyUpdate}
        disabled={selectedCellsCount === 0}
      >
        {t("mysql.tableManager.copyAsUpdateStatement")}
      </button>
      <div className="context-menu-separator" />
      <button
        type="button"
        className="btn btn-sm btn-ghost context-menu-button"
        onClick={onFilterByValue}
      >
        {t("mysql.tableManager.filterByCurrentValue")}
      </button>
      <button
        type="button"
        className="btn btn-sm btn-ghost context-menu-button"
        onClick={onSortAsc}
      >
        {t("dataBrowser.sortAscending")}
      </button>
      <button
        type="button"
        className="btn btn-sm btn-ghost context-menu-button"
        onClick={onSortDesc}
      >
        {t("dataBrowser.sortDescending")}
      </button>
    </div>
  );
}
