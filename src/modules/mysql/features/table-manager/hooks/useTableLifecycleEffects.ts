import type { MutableRefObject } from "react";
import { useEffect, useRef } from "react";
import { getMysqlOpenedTableKey, type MysqlOpenedTable, type MysqlTableDataCacheEntry } from "../../../types";
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
  getTableDataCache: () => Record<string, MysqlTableDataCacheEntry>;
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
  getTableDataCache,
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

    // ── activeOpenedTable actually changed ──

    // Try restore from cache for the NEW table
    const newKey = getMysqlOpenedTableKey(activeOpenedTable.database, activeOpenedTable.table);
    const cached = getTableDataCache()[newKey];

    if (cached) {
      const safePage = cached.total > 0
        ? Math.min(cached.page, Math.max(1, Math.ceil(cached.total / cached.pageSize)))
        : 1;
      setSelectedTableInfo({
        database: activeOpenedTable.database,
        table: activeOpenedTable.table,
        columns: cached.columnMeta,
        rowCount: cached.tableInfo?.rowCount ?? 0,
        info: cached.tableInfo?.info as any,
        loading: false,
      });
      setDataColumnMeta(cached.columnMeta);
      setDataState({
        columns: cached.columns,
        rows: cached.rows,
        total: cached.total,
        page: safePage,
        pageSize: cached.pageSize,
        loading: false,
        error: "",
      });
      latestDataRequestRef.current += 1;
      activeDataRequestKeyRef.current = null;
      prevOpenedTableRef.current = { database: activeOpenedTable.database, table: activeOpenedTable.table };
      return;
    }

    // Not cached — proceed with normal fetch
    // Cache is saved inside handleOpenTable → fetchData after the fetch completes
    prevOpenedTableRef.current = { database: activeOpenedTable.database, table: activeOpenedTable.table };
    void handleOpenTableRef.current(activeOpenedTable.database, activeOpenedTable.table, activeOpenedTable.view);
  }, [activeOpenedTable, isTableWorkspace]);

  // 仅在切换到不同表时同步过滤草稿，避免因 visibleColumns 等无关字段变化覆盖用户正在编辑的过滤条件
  const lastSyncedTableRef = useRef<{ database: string; table: string } | null>(null);

  useEffect(() => {
    if (!activeOpenedTable) return;
    const prev = lastSyncedTableRef.current;
    if (prev?.database === activeOpenedTable.database && prev?.table === activeOpenedTable.table) {
      return;
    }
    lastSyncedTableRef.current = { database: activeOpenedTable.database, table: activeOpenedTable.table };
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
