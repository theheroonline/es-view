import type { MutableRefObject } from "react";
import { useEffect, useRef } from "react";
import type { MysqlOpenedTable } from "../../../types";
import type { DataState, RightPanelTab, TableInfo } from "../utils";

interface UseTableLifecycleEffectsProps {
  selectedOverviewTablesRef: MutableRefObject<string[]>;
  selectedOverviewTables: string[];
  isTableWorkspace: boolean;
  activeOpenedTable: MysqlOpenedTable | null;
  handleOpenTable: (db: string, table: string, targetTab: RightPanelTab) => Promise<void>;
  syncFilterDraftFromOpenedTable: (table: MysqlOpenedTable | null, columns: string[]) => void;
  dataColumns: string[];
  connectionId: string | null | undefined;
  latestDataRequestRef: MutableRefObject<number>;
  activeDataRequestKeyRef: MutableRefObject<string | null>;
  setSelectedTableInfo: (info: TableInfo | null) => void;
  setDataState: (updater: DataState) => void;
  setDataColumnMeta: (columns: any[]) => void;
  clearOverviewTableSelection: () => void;
  expandedDatabase: string | null;
  tablesByDb: Record<string, string[]>;
  refreshTablesForDb: (db: string) => Promise<void>;
  selectedTableInfo: TableInfo | null;
  locationPathname: string;
  setSelectedTable: (table: string | undefined) => void;
  setRightPanelTab: (tab: RightPanelTab) => void;
  defaultDataState: DataState;
}

export function useTableLifecycleEffects({
  selectedOverviewTablesRef,
  selectedOverviewTables,
  isTableWorkspace,
  activeOpenedTable,
  handleOpenTable,
  syncFilterDraftFromOpenedTable,
  dataColumns,
  connectionId,
  latestDataRequestRef,
  activeDataRequestKeyRef,
  setSelectedTableInfo,
  setDataState,
  setDataColumnMeta,
  clearOverviewTableSelection,
  expandedDatabase,
  tablesByDb,
  refreshTablesForDb,
  selectedTableInfo,
  locationPathname,
  setSelectedTable,
  setRightPanelTab,
  defaultDataState,
}: UseTableLifecycleEffectsProps) {
  // Use a ref for handleOpenTable to avoid re-triggering the effect when the function identity changes
  const handleOpenTableRef = useRef(handleOpenTable);
  handleOpenTableRef.current = handleOpenTable;

  // Track previously opened table to skip redundant re-fetches on double-click
  const prevOpenedTableRef = useRef<{ database: string; table: string } | null>(null);

  useEffect(() => {
    selectedOverviewTablesRef.current = selectedOverviewTables;
  }, [selectedOverviewTables, selectedOverviewTablesRef]);

  useEffect(() => {
    if (!isTableWorkspace || !activeOpenedTable) return;
    if (
      prevOpenedTableRef.current?.database === activeOpenedTable.database &&
      prevOpenedTableRef.current?.table === activeOpenedTable.table
    ) {
      return;
    }
    prevOpenedTableRef.current = { database: activeOpenedTable.database, table: activeOpenedTable.table };
    void handleOpenTableRef.current(activeOpenedTable.database, activeOpenedTable.table, activeOpenedTable.view);
  }, [activeOpenedTable, isTableWorkspace]);

  useEffect(() => {
    if (!activeOpenedTable) return;
    syncFilterDraftFromOpenedTable(activeOpenedTable, dataColumns);
  }, [activeOpenedTable, dataColumns, syncFilterDraftFromOpenedTable]);

  useEffect(() => {
    if (!connectionId) {
      latestDataRequestRef.current += 1;
      activeDataRequestKeyRef.current = null;
      setSelectedTableInfo(null);
      setDataState(defaultDataState);
      setDataColumnMeta([]);
      clearOverviewTableSelection();
      return;
    }

    if (!expandedDatabase && !activeOpenedTable) {
      latestDataRequestRef.current += 1;
      activeDataRequestKeyRef.current = null;
      setSelectedTableInfo(null);
      setDataState(defaultDataState);
      setDataColumnMeta([]);
      setSelectedTable(undefined);
      clearOverviewTableSelection();
      return;
    }

    if (expandedDatabase && !tablesByDb[expandedDatabase]) {
      void refreshTablesForDb(expandedDatabase);
    }

    if (selectedTableInfo && locationPathname !== "/mysql/table" && selectedTableInfo.database !== expandedDatabase) {
      latestDataRequestRef.current += 1;
      activeDataRequestKeyRef.current = null;
      setSelectedTableInfo(null);
      setDataState(defaultDataState);
      setDataColumnMeta([]);
      setSelectedTable(undefined);
      setRightPanelTab("structure");
    }
  }, [
    activeOpenedTable,
    activeDataRequestKeyRef,
    clearOverviewTableSelection,
    connectionId,
    defaultDataState,
    expandedDatabase,
    latestDataRequestRef,
    locationPathname,
    refreshTablesForDb,
    selectedTableInfo,
    setDataColumnMeta,
    setDataState,
    setRightPanelTab,
    setSelectedTable,
    setSelectedTableInfo,
    tablesByDb,
  ]);

  useEffect(() => {
    clearOverviewTableSelection();
  }, [clearOverviewTableSelection, expandedDatabase]);
}
