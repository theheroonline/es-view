import type { MutableRefObject } from "react";
import { useEffect, useRef } from "react";
import { getMysqlOpenedTableKey, getMysqlOpenedTableTabKey, type MysqlOpenedTable, type MysqlTableDataCacheEntry } from "../../../types";
import type { DataState, RightPanelTab, TableInfo } from "../utils";

// Module-level set tracking tables that have been loaded during this session.
// Key includes connectionId to prevent cross-connection pollution when
// different connections access the same database/table names.
const loadedTableKeys = new Set<string>();

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
  setOpenedTables: (updater: (prev: MysqlOpenedTable[]) => MysqlOpenedTable[]) => void;
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
  setOpenedTables,
}: UseTableLifecycleEffectsProps) {
  // Use a ref for handleOpenTable to avoid re-triggering the effect when the function identity changes
  const handleOpenTableRef = useRef(handleOpenTable);
  handleOpenTableRef.current = handleOpenTable;

  // Refs for values read in the connection-lifecycle effect without adding them to deps.
  // These fields change frequently (on every render) but the effect should only react
  // to connection / navigation / sidebar-tree changes.
  const activeOpenedTableRef = useRef(activeOpenedTable);
  const selectedTableInfoRef = useRef(selectedTableInfo);
  activeOpenedTableRef.current = activeOpenedTable;
  selectedTableInfoRef.current = selectedTableInfo;

  // Track previously opened table key (db+table+view) to detect actual tab switches.
  const prevTableTabKeyRef = useRef<string | null>(null);

  useEffect(() => {
    selectedOverviewTablesRef.current = selectedOverviewTables;
  }, [selectedOverviewTables, selectedOverviewTablesRef]);

  useEffect(() => {
    if (!isTableWorkspace || !activeOpenedTable) return;
    const currentTabKey = getMysqlOpenedTableTabKey(connectionId ?? "", activeOpenedTable.database, activeOpenedTable.table);
    if (prevTableTabKeyRef.current === currentTabKey) return;

    // ── activeOpenedTable actually changed ──

    // Key for module-level loadedTableKeys — must include connectionId
    // to prevent cross-connection pollution.
    const loadKey = `${connectionId}::${activeOpenedTable.database}::${activeOpenedTable.table}`;
    // Key for connection-scoped tableDataCache — already isolated per connection.
    const cacheKey = getMysqlOpenedTableKey(activeOpenedTable.database, activeOpenedTable.table);
    const cached = getTableDataCache()[cacheKey];

    // Skip stale empty cache when user wants data tab — this can happen
    // when a table was previously opened in structure/info mode only.
    // Also remove from loadedTableKeys so the fetch proceeds below.
    const isEmptyCache = cached != null && cached.total === 0 && cached.rows.length === 0;
    if (cached != null && !(isEmptyCache && activeOpenedTable.view === "data")) {
      const safePage = cached.total > 0
        ? Math.min(cached.page, Math.max(1, Math.ceil(cached.total / cached.pageSize)))
        : 1;
      const tableKey = getMysqlOpenedTableTabKey(activeOpenedTable.database, activeOpenedTable.table, activeOpenedTable.view);
      setOpenedTables((prev) => prev.map((item) => (
        getMysqlOpenedTableTabKey(item.database, item.table, item.view) === tableKey
          ? { ...item, page: safePage, pageSize: cached.pageSize }
          : item
      )));
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
      loadedTableKeys.add(loadKey);
      prevTableTabKeyRef.current = currentTabKey;
      return;
    }

    // Empty cache was skipped — don't let loadedTableKeys block the refetch
    if (isEmptyCache && activeOpenedTable.view === "data") {
      loadedTableKeys.delete(loadKey);
    }

    // Not cached — check if this table has been loaded before.
    // If it has but cache was cleared (e.g., column toggle), don't refetch
    // to avoid resetting the user's position to page 1.
    if (loadedTableKeys.has(loadKey)) {
      return;
    }

    // Not cached and never loaded — proceed with normal fetch
    // Cache is saved inside handleOpenTable → fetchData after the fetch completes
    loadedTableKeys.add(loadKey);
    prevTableTabKeyRef.current = currentTabKey;
    void handleOpenTableRef.current(activeOpenedTable.database, activeOpenedTable.table, activeOpenedTable.view);
  }, [activeOpenedTable, isTableWorkspace]);

  // Sync filter draft from the opened table's persisted filterTree when:
  // 1. Connection changes → always re-sync
  // 2. Table changes (even if seen before) → re-sync to restore filter
  // 3. Columns become available after initial load → re-sync
  const lastSyncedTableRef = useRef<{ connectionId: string | null | undefined; database: string; table: string } | null>(null);
  const prevDataColumnsLengthRef = useRef(dataColumns.length);
  const prevConnectionIdRef = useRef(connectionId);

  useEffect(() => {
    if (!activeOpenedTable) return;

    // Connection change always triggers a fresh sync
    if (prevConnectionIdRef.current !== connectionId) {
      prevConnectionIdRef.current = connectionId;
      lastSyncedTableRef.current = { connectionId, database: activeOpenedTable.database, table: activeOpenedTable.table };
      prevDataColumnsLengthRef.current = 0; // Reset to allow column re-sync
      syncFilterDraftFromOpenedTable(activeOpenedTable, dataColumns);
      return;
    }

    const prev = lastSyncedTableRef.current;
    const isNewTable = prev?.database !== activeOpenedTable.database || prev?.table !== activeOpenedTable.table;
    const columnsJustBecameAvailable = prevDataColumnsLengthRef.current === 0 && dataColumns.length > 0;

    // Always re-sync when switching tables (even back to a previously seen one)
    // so that filterDraftTree is restored from activeOpenedTable.filterTree.
    if (isNewTable || columnsJustBecameAvailable) {
      lastSyncedTableRef.current = { connectionId, database: activeOpenedTable.database, table: activeOpenedTable.table };
      syncFilterDraftFromOpenedTable(activeOpenedTable, dataColumns);
    }
    prevDataColumnsLengthRef.current = dataColumns.length;
  }, [activeOpenedTable, dataColumns, syncFilterDraftFromOpenedTable, connectionId]);

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

    if (!expandedDatabase && !activeOpenedTableRef.current) {
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

    if (selectedTableInfoRef.current && locationPathname === "/mysql/tables" && selectedTableInfoRef.current.database !== expandedDatabase) {
      latestDataRequestRef.current += 1;
      activeDataRequestKeyRef.current = null;
      setSelectedTableInfo(null);
      setDataState(defaultDataState);
      setDataColumnMeta([]);
      setSelectedTable(undefined);
      setRightPanelTab("structure");
    }
  }, [
    activeDataRequestKeyRef,
    clearOverviewTableSelection,
    connectionId,
    defaultDataState,
    expandedDatabase,
    latestDataRequestRef,
    locationPathname,
    refreshTablesForDb,
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
