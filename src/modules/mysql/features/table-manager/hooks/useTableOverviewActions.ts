import { useCallback, type DragEvent, type MouseEvent } from "react";
import { getMysqlOpenedTableKey, type MysqlOpenedTable } from "../../../types";
import type { RightPanelTab } from "../utils";

interface UseTableOverviewActionsProps {
  tablesByDb: Record<string, string[]>;
  selectedOverviewTables: string[];
  overviewSelectionAnchor: string | null;
  setSelectedDatabase: (database: string | undefined) => void;
  setSelectedTable: (table: string | undefined) => void;
  setSelectedOverviewTables: (tables: string[] | ((prev: string[]) => string[])) => void;
  setOverviewSelectionAnchor: (table: string | null) => void;
  setOpenedTables: (tables: MysqlOpenedTable[] | ((prev: MysqlOpenedTable[]) => MysqlOpenedTable[])) => void;
  setActiveOpenedTableKey: (key: string | null) => void;
  navigate: (to: string) => void | Promise<void>;
}

export function useTableOverviewActions({
  tablesByDb,
  selectedOverviewTables,
  overviewSelectionAnchor,
  setSelectedDatabase,
  setSelectedTable,
  setSelectedOverviewTables,
  setOverviewSelectionAnchor,
  setOpenedTables,
  setActiveOpenedTableKey,
  navigate,
}: UseTableOverviewActionsProps) {
  const handleSelectTable = useCallback((db: string, table: string) => {
    setSelectedDatabase(db);
    setSelectedTable(table);
  }, [setSelectedDatabase, setSelectedTable]);

  const getOrderedSelectedTables = useCallback((db: string, tables: string[]) => {
    const availableTables = tablesByDb[db] ?? [];
    const selectedSet = new Set(tables);
    return availableTables.filter((table) => selectedSet.has(table));
  }, [tablesByDb]);

  const handleOverviewTableClick = useCallback((event: MouseEvent<HTMLDivElement>, db: string, table: string) => {
    handleSelectTable(db, table);

    const availableTables = tablesByDb[db] ?? [];
    const canSelectRange = event.shiftKey && overviewSelectionAnchor && availableTables.includes(overviewSelectionAnchor);
    const isToggleSelection = event.ctrlKey || event.metaKey;

    setSelectedOverviewTables((previous) => {
      if (canSelectRange && overviewSelectionAnchor) {
        const startIndex = availableTables.indexOf(overviewSelectionAnchor);
        const endIndex = availableTables.indexOf(table);
        return availableTables.slice(Math.min(startIndex, endIndex), Math.max(startIndex, endIndex) + 1);
      }

      if (isToggleSelection) {
        return previous.includes(table)
          ? previous.filter((item) => item !== table)
          : getOrderedSelectedTables(db, [...previous, table]);
      }

      return [table];
    });

    setOverviewSelectionAnchor(table);
  }, [getOrderedSelectedTables, handleSelectTable, overviewSelectionAnchor, setOverviewSelectionAnchor, setSelectedOverviewTables, tablesByDb]);

  const clearOverviewTableSelection = useCallback(() => {
    setSelectedOverviewTables([]);
    setOverviewSelectionAnchor(null);
  }, [setOverviewSelectionAnchor, setSelectedOverviewTables]);

  const handleOverviewTableDragStart = useCallback((event: DragEvent<HTMLDivElement>, db: string, table: string) => {
    const draggedTables = selectedOverviewTables.includes(table)
      ? getOrderedSelectedTables(db, selectedOverviewTables)
      : [table];

    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-mysql-table", JSON.stringify({
      database: db,
      tables: draggedTables,
    }));
  }, [getOrderedSelectedTables, selectedOverviewTables]);

  const openTableWorkspace = useCallback(async (db: string, table: string, targetTab: RightPanelTab) => {
    const nextKey = getMysqlOpenedTableKey(db, table);
    setSelectedDatabase(db);
    setSelectedTable(table);
    setOpenedTables((prev) => {
      const existing = prev.find((item) => getMysqlOpenedTableKey(item.database, item.table) === nextKey);
      if (existing) {
        return prev.map((item) => getMysqlOpenedTableKey(item.database, item.table) === nextKey ? { ...item, view: targetTab } : item);
      }
      return [...prev, { database: db, table, view: targetTab }];
    });
    setActiveOpenedTableKey(nextKey);
    await navigate("/mysql/table");
  }, [navigate, setActiveOpenedTableKey, setOpenedTables, setSelectedDatabase, setSelectedTable]);

  const handleBrowseData = useCallback(async (db: string, table: string) => {
    await openTableWorkspace(db, table, "data");
  }, [openTableWorkspace]);

  const handleDesignTable = useCallback(async (db: string, table: string) => {
    await openTableWorkspace(db, table, "structure");
  }, [openTableWorkspace]);

  return {
    handleSelectTable,
    getOrderedSelectedTables,
    handleOverviewTableClick,
    clearOverviewTableSelection,
    handleOverviewTableDragStart,
    openTableWorkspace,
    handleBrowseData,
    handleDesignTable,
  };
}
