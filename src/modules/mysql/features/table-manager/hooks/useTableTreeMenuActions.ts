import { Modal } from "antd";
import { useCallback, type MouseEvent, type MutableRefObject, type SetStateAction } from "react";
import type { ExportSelectionModalState, RightPanelTab, TableInfo, TreeContextMenu } from "../utils";

interface UseTableTreeMenuActionsProps {
  selectedOverviewTablesRef: MutableRefObject<string[]>;
  selectedTableInfo: TableInfo | null;
  rightPanelTab: RightPanelTab;
  tablesByDb: Record<string, string[]>;
  t: (key: string, options?: any) => string;
  handleSelectTable: (db: string, table: string) => void;
  getOrderedSelectedTables: (db: string, tables: string[]) => string[];
  refreshTablesForDb: (db: string) => Promise<void>;
  handleOpenTable: (db: string, table: string, targetTab: RightPanelTab) => Promise<void>;
  handleBrowseData: (db: string, table: string) => Promise<void>;
  handleDesignTable: (db: string, table: string) => Promise<void>;
  handleCopyTable: (db: string, table: string) => Promise<void>;
  handleTruncateTable: (db: string, table: string) => Promise<void>;
  handleDropTable: (db: string, table: string) => Promise<void>;
  handleExportTableSql: (database: string, table: string, includeData: boolean) => Promise<void>;
  exportImportHandleImportTableSql: (
    database: string,
    table: string,
    onImportSuccess?: (message?: string) => Promise<void>
  ) => Promise<void>;
  setSelectedOverviewTables: (tables: string[]) => void;
  setOverviewSelectionAnchor: (table: string | null) => void;
  setTreeContextMenu: (menu: TreeContextMenu | null) => void;
  setExportSelectionModal: (state: SetStateAction<ExportSelectionModalState | null>) => void;
}

export function useTableTreeMenuActions({
  selectedOverviewTablesRef,
  selectedTableInfo,
  rightPanelTab,
  tablesByDb,
  t,
  handleSelectTable,
  getOrderedSelectedTables,
  refreshTablesForDb,
  handleOpenTable,
  handleBrowseData,
  handleDesignTable,
  handleCopyTable,
  handleTruncateTable,
  handleDropTable,
  handleExportTableSql,
  exportImportHandleImportTableSql,
  setSelectedOverviewTables,
  setOverviewSelectionAnchor,
  setTreeContextMenu,
  setExportSelectionModal,
}: UseTableTreeMenuActionsProps) {
  const closeTreeMenu = useCallback(() => {
    setTreeContextMenu(null);
  }, [setTreeContextMenu]);

  const handleTableContextMenu = useCallback((e: MouseEvent, db: string, table: string) => {
    e.preventDefault();
    e.stopPropagation();
    handleSelectTable(db, table);

    const currentSelectedTables = selectedOverviewTablesRef.current;
    const nextSelectedTables = currentSelectedTables.includes(table)
      ? getOrderedSelectedTables(db, currentSelectedTables)
      : [table];

    if (!currentSelectedTables.includes(table)) {
      setSelectedOverviewTables([table]);
      selectedOverviewTablesRef.current = [table];
      setOverviewSelectionAnchor(table);
    }

    const x = Math.max(8, Math.min(e.clientX, window.innerWidth - 320));
    const y = Math.max(8, Math.min(e.clientY, window.innerHeight - 360));
    setTreeContextMenu({ db, table, selectedTables: nextSelectedTables, x, y });
  }, [getOrderedSelectedTables, handleSelectTable, selectedOverviewTablesRef, setOverviewSelectionAnchor, setSelectedOverviewTables, setTreeContextMenu]);

  const handleExportTableSqlWrapper = useCallback(
    async (database: string, table: string, includeData: boolean) => {
      await handleExportTableSql(database, table, includeData);
      closeTreeMenu();
    },
    [closeTreeMenu, handleExportTableSql]
  );

  const handleImportTableSql = useCallback(
    async (database: string, table: string) => {
      await exportImportHandleImportTableSql(database, table, async (message?: string) => {
        await refreshTablesForDb(database);
        if (selectedTableInfo?.database === database && selectedTableInfo.table === table) {
          await handleOpenTable(database, table, rightPanelTab);
        }
        if (message) {
          Modal.success({
            title: t("common.success"),
            content: message
          });
        }
      });
      closeTreeMenu();
    },
    [closeTreeMenu, exportImportHandleImportTableSql, handleOpenTable, refreshTablesForDb, rightPanelTab, selectedTableInfo, t]
  );

  const openExportSelectionModal = useCallback((database: string, tables: string[], includeData: boolean) => {
    const availableTables = tablesByDb[database] ?? [];
    const orderedTables = getOrderedSelectedTables(database, tables);
    const initialSelection = orderedTables.length > 0
      ? orderedTables
      : availableTables.length > 0
        ? [availableTables[0]]
        : [];

    setExportSelectionModal({
      database,
      availableTables,
      selectedTables: initialSelection,
      includeData,
    });
    closeTreeMenu();
  }, [closeTreeMenu, getOrderedSelectedTables, setExportSelectionModal, tablesByDb]);

  const handleToggleExportSelectionTable = useCallback((table: string) => {
    setExportSelectionModal((previous) => {
      if (!previous) return previous;
      const selectedTables = previous.selectedTables.includes(table)
        ? previous.selectedTables.filter((item) => item !== table)
        : getOrderedSelectedTables(previous.database, [...previous.selectedTables, table]);
      return { ...previous, selectedTables };
    });
  }, [getOrderedSelectedTables, setExportSelectionModal]);

  const handleTreeOpenTableWithClose = useCallback(async (db: string, table: string) => {
    closeTreeMenu();
    await handleBrowseData(db, table);
  }, [closeTreeMenu, handleBrowseData]);

  const handleTreeDesignTableWithClose = useCallback(async (db: string, table: string) => {
    closeTreeMenu();
    await handleDesignTable(db, table);
  }, [closeTreeMenu, handleDesignTable]);

  const handleTreeCopyTableWithClose = useCallback(async (db: string, table: string) => {
    closeTreeMenu();
    await handleCopyTable(db, table);
  }, [closeTreeMenu, handleCopyTable]);

  const handleTreeTruncateTableWithClose = useCallback(async (db: string, table: string) => {
    closeTreeMenu();
    await handleTruncateTable(db, table);
  }, [closeTreeMenu, handleTruncateTable]);

  const handleTreeDropTableWithClose = useCallback(async (db: string, table: string) => {
    closeTreeMenu();
    await handleDropTable(db, table);
  }, [closeTreeMenu, handleDropTable]);

  return {
    handleTableContextMenu,
    handleExportTableSqlWrapper,
    handleImportTableSql,
    openExportSelectionModal,
    handleToggleExportSelectionTable,
    handleTreeOpenTableWithClose,
    handleTreeDesignTableWithClose,
    handleTreeCopyTableWithClose,
    handleTreeTruncateTableWithClose,
    handleTreeDropTableWithClose,
  };
}
