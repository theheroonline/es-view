import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { TreeContextMenu as TreeContextMenuState } from "../utils";

interface TreeContextMenuProps {
  menu: TreeContextMenuState | null;
  style: CSSProperties;
  onOpenTable: (db: string, table: string) => void;
  onDesignTable: (db: string, table: string) => void;
  onImportSql: (db: string, table: string) => void;
  onExportStructure: (db: string, table: string) => void;
  onExportStructureAndData: (db: string, table: string) => void;
  onExportSelected: (db: string, tables: string[]) => void;
  onCopyTable: (db: string, table: string) => void;
  onTruncateTable: (db: string, table: string) => void;
  onDropTable: (db: string, table: string) => void;
}

export function TreeContextMenu({
  menu,
  style,
  onOpenTable,
  onDesignTable,
  onImportSql,
  onExportStructure,
  onExportStructureAndData,
  onExportSelected,
  onCopyTable,
  onTruncateTable,
  onDropTable,
}: TreeContextMenuProps) {
  const { t } = useTranslation();

  if (!menu) return null;

  return (
    <div className="context-menu-panel" style={style} onClick={(event) => event.stopPropagation()}>
      {menu.selectedTables.length <= 1 ? (
        <>
          <button type="button" className="btn btn-sm btn-ghost context-menu-button" onClick={() => onOpenTable(menu.db, menu.table)}>
            {t("mysql.tableManager.openTable")}
          </button>
          <button type="button" className="btn btn-sm btn-ghost context-menu-button" onClick={() => onDesignTable(menu.db, menu.table)}>
            {t("mysql.tableManager.designTable")}
          </button>
          <div className="context-menu-separator" />
          <button type="button" className="btn btn-sm btn-ghost context-menu-button" onClick={() => onImportSql(menu.db, menu.table)}>
            {t("mysql.tableManager.importSql")}
          </button>
          <button type="button" className="btn btn-sm btn-ghost context-menu-button" onClick={() => onExportStructure(menu.db, menu.table)}>
            {t("mysql.tableManager.exportStructure")}
          </button>
          <button type="button" className="btn btn-sm btn-ghost context-menu-button" onClick={() => onExportStructureAndData(menu.db, menu.table)}>
            {t("mysql.tableManager.exportStructureAndData")}
          </button>
          <button type="button" className="btn btn-sm btn-ghost context-menu-button" onClick={() => onExportSelected(menu.db, [menu.table])}>
            {t("mysql.tableManager.exportSelectedTables")}
          </button>
          <div className="context-menu-separator" />
          <button type="button" className="btn btn-sm btn-ghost context-menu-button" onClick={() => onCopyTable(menu.db, menu.table)}>
            {t("mysql.tableManager.copyTable")}
          </button>
          <button type="button" className="btn btn-sm btn-ghost context-menu-button" onClick={() => onTruncateTable(menu.db, menu.table)}>
            {t("mysql.tableManager.truncate")}
          </button>
          <button type="button" className="btn btn-sm btn-ghost text-danger context-menu-button" onClick={() => onDropTable(menu.db, menu.table)}>
            {t("mysql.tableManager.dropTable")}
          </button>
        </>
      ) : (
        <button type="button" className="btn btn-sm btn-ghost context-menu-button" onClick={() => onExportSelected(menu.db, menu.selectedTables)}>
          {t("mysql.tableManager.exportSelectedTables")}
        </button>
      )}
    </div>
  );
}
