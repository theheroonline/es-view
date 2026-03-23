import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { ColumnHeaderContextMenu as ColumnHeaderContextMenuState } from "../utils";

interface ColumnHeaderContextMenuProps {
  menu: ColumnHeaderContextMenuState | null;
  style: CSSProperties;
  onSortAsc: () => void;
  onSortDesc: () => void;
  onClearSort: () => void;
}

export function ColumnHeaderContextMenu({
  menu,
  style,
  onSortAsc,
  onSortDesc,
  onClearSort,
}: ColumnHeaderContextMenuProps) {
  const { t } = useTranslation();

  if (!menu) return null;

  return (
    <div className="context-menu-panel" style={style} onClick={(event) => event.stopPropagation()}>
      <button type="button" className="btn btn-sm btn-ghost context-menu-button" onClick={onSortAsc}>
        {t("dataBrowser.sortAscending")}
      </button>
      <button type="button" className="btn btn-sm btn-ghost context-menu-button" onClick={onSortDesc}>
        {t("dataBrowser.sortDescending")}
      </button>
      <button type="button" className="btn btn-sm btn-ghost context-menu-button" onClick={onClearSort}>
        {t("mysql.tableManager.clearSort")}
      </button>
    </div>
  );
}
