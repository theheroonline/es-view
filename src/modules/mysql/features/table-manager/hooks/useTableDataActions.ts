import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback, useMemo } from "react";
import { logError } from "../../../../../lib/errorLog";
import { getMysqlOpenedTableKey, type MysqlFilterNode, type MysqlOpenedTable, type MysqlTableDataCacheEntry } from "../../../types";
import { fetchTablePage } from "../services/tableDataService";
import {
    buildConditionSql as buildFilterConditionSql,
    cloneFilterGroup,
    createFilterCondition,
    createFilterGroup,
    type DataState,
    escapeSqlIdentifier,
    type FilterConditionDraft,
    type FilterGroupDraft,
    sanitizeFilterNode,
    type TableInfo,
} from "../utils";

interface UseTableDataActionsProps {
  connectionId: string | null | undefined;
  activeOpenedTable: MysqlOpenedTable | null;
  selectedTableInfo: TableInfo | null;
  dataState: DataState;
  latestDataRequestRef: MutableRefObject<number>;
  activeDataRequestKeyRef: MutableRefObject<string | null>;
  setDataState: Dispatch<SetStateAction<DataState>>;
  setOpenedTables: Dispatch<SetStateAction<MysqlOpenedTable[]>>;
  setFilterDraftTree: Dispatch<SetStateAction<FilterGroupDraft | null>>;
  setFilterPanelOpen: Dispatch<SetStateAction<boolean>>;
  setSortModalOpen: Dispatch<SetStateAction<boolean>>;
  setSortDraft: Dispatch<SetStateAction<{ column: string; direction: "asc" | "desc" }>>;
  filterDraftTree: FilterGroupDraft | null;
  setError: (message: string) => void;
  saveTableDataCache: (tableKey: string, entry: MysqlTableDataCacheEntry | null) => void;
  dataColumnMeta: Array<{ field: string; type: string; null: string; key: string; default: string | null; extra: string }>;
}

function buildNodeSql(node: MysqlFilterNode): string | null {
  if (node.kind === "condition") {
    return buildFilterConditionSql(node as FilterConditionDraft);
  }

  const childSql = node.children
    .map((child) => buildNodeSql(child))
    .filter((part): part is string => Boolean(part));

  if (childSql.length === 0) return null;
  const joiner = node.mode === "or" ? " OR " : " AND ";
  return childSql.length === 1 ? childSql[0] : `(${childSql.join(joiner)})`;
}

export function useTableDataActions({
  connectionId,
  activeOpenedTable,
  selectedTableInfo,
  dataState,
  latestDataRequestRef,
  activeDataRequestKeyRef,
  setDataState,
  setOpenedTables,
  setFilterDraftTree,
  setFilterPanelOpen,
  setSortModalOpen,
  setSortDraft,
  filterDraftTree,
  setError,
  saveTableDataCache,
  dataColumnMeta,
}: UseTableDataActionsProps) {
  const getWhereClause = useCallback((tree?: FilterGroupDraft | null) => {
    if (!tree) return "";
    const sql = buildNodeSql(tree);
    return sql ? ` WHERE ${sql}` : "";
  }, []);

  const syncFilterDraftFromOpenedTable = useCallback((table: MysqlOpenedTable | null, columns: string[]) => {
    const firstColumn = columns[0] ?? "";
    const tree = table?.filterTree
      ? cloneFilterGroup(table.filterTree, firstColumn)
      : createFilterGroup("and", [createFilterCondition(firstColumn)]);
    setFilterDraftTree(tree);
  }, [setFilterDraftTree]);

  const updateOpenedTableQueryState = useCallback(
    (
      db: string,
      table: string,
      next: Partial<Pick<MysqlOpenedTable, "filterTree" | "sortColumn" | "sortDirection">>
    ) => {
      const nextKey = getMysqlOpenedTableKey(db, table);
      setOpenedTables((prev) => prev.map((item) => (
        getMysqlOpenedTableKey(item.database, item.table) === nextKey
          ? { ...item, ...next }
          : item
      )));
    },
    [setOpenedTables]
  );

  const fetchData = useCallback(async (
    db?: string,
    table?: string,
    page?: number,
    pageSize?: number,
    overrides?: Partial<Pick<MysqlOpenedTable, "filterTree" | "sortColumn" | "sortDirection">>
  ) => {
    const targetDb = db ?? selectedTableInfo?.database;
    const targetTable = table ?? selectedTableInfo?.table;
    if (!connectionId || !targetDb || !targetTable) return;

    const currentPage = page ?? dataState.page;
    const currentSize = pageSize ?? dataState.pageSize;
    const requestKey = `${targetDb}.${targetTable}`;
    const requestId = latestDataRequestRef.current + 1;
    latestDataRequestRef.current = requestId;
    activeDataRequestKeyRef.current = requestKey;

    const isTargetActiveTable = !!(db && table && activeOpenedTable?.database === db && activeOpenedTable?.table === table);
    const currentFilterTree = overrides?.filterTree ?? (isTargetActiveTable ? activeOpenedTable?.filterTree : undefined);
    const currentSortColumn = isTargetActiveTable
      ? overrides?.sortColumn ?? activeOpenedTable.sortColumn
      : overrides?.sortColumn;
    const currentSortDirection = isTargetActiveTable
      ? overrides?.sortDirection ?? activeOpenedTable.sortDirection
      : overrides?.sortDirection;

    const whereClause = getWhereClause(currentFilterTree);
    const orderClause = currentSortColumn
      ? ` ORDER BY ${escapeSqlIdentifier(currentSortColumn)} ${(currentSortDirection ?? "asc").toUpperCase()}`
      : "";

    setDataState((prev) => ({ ...prev, loading: true, error: "" }));

    try {
      const { total, dataResult } = await fetchTablePage(
        connectionId,
        targetDb,
        targetTable,
        currentPage,
        currentSize,
        whereClause,
        orderClause
      );

      if (requestId !== latestDataRequestRef.current || activeDataRequestKeyRef.current !== requestKey) {
        setDataState((prev) => ({ ...prev, loading: false }));
        return;
      }

      setDataState({
        columns: dataResult.columns,
        rows: dataResult.rows,
        total,
        page: currentPage,
        pageSize: currentSize,
        loading: false,
        error: ""
      });

      const cachedTableKey = getMysqlOpenedTableKey(targetDb, targetTable);
      saveTableDataCache(cachedTableKey, {
        columns: dataResult.columns,
        rows: dataResult.rows,
        total,
        page: currentPage,
        pageSize: currentSize,
        columnMeta: dataColumnMeta,
        tableInfo: selectedTableInfo
          ? { columns: selectedTableInfo.columns ?? [], rowCount: selectedTableInfo.rowCount ?? 0, info: selectedTableInfo.info ?? {} }
          : null,
        dataColumns: dataResult.columns,
        cachedAt: Date.now(),
      });
    } catch (err) {
      logError(err, {
        source: "useTableDataActions.fetchData",
        message: `Failed to fetch table data for ${targetDb}.${targetTable}`
      });
      if (requestId !== latestDataRequestRef.current || activeDataRequestKeyRef.current !== requestKey) {
        setDataState((prev) => ({ ...prev, loading: false }));
        return;
      }

      setDataState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : String(err)
      }));
    }
  }, [activeDataRequestKeyRef, activeOpenedTable, connectionId, getWhereClause, latestDataRequestRef, selectedTableInfo?.database, selectedTableInfo?.table, setDataState, saveTableDataCache, dataColumnMeta]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(dataState.total / dataState.pageSize)), [dataState.pageSize, dataState.total]);

  const handlePageChange = useCallback((newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    void fetchData(undefined, undefined, newPage);
  }, [fetchData, totalPages]);

  const handlePageSizeChange = useCallback((newSize: number) => {
    void fetchData(undefined, undefined, 1, newSize);
  }, [fetchData]);

  const visibleDataColumns = useMemo(() => {
    const preferred = activeOpenedTable?.visibleColumns;
    if (!preferred || preferred.length === 0) {
      return dataState.columns;
    }
    const nextColumns = preferred.filter((column) => dataState.columns.includes(column));
    return nextColumns.length > 0 ? nextColumns : dataState.columns;
  }, [activeOpenedTable?.visibleColumns, dataState.columns]);

  const updateOpenedTableVisibleColumns = useCallback((db: string, table: string, visibleColumns: string[]) => {
    const nextKey = getMysqlOpenedTableKey(db, table);
    setOpenedTables((prev) => prev.map((item) => (
      getMysqlOpenedTableKey(item.database, item.table) === nextKey
        ? { ...item, visibleColumns: visibleColumns.length > 0 ? visibleColumns : dataState.columns }
        : item
    )));
  }, [dataState.columns, setOpenedTables]);

  const handleVisibleColumnToggle = useCallback(async (column: string, checked: boolean) => {
    if (!activeOpenedTable) return;
    const nextColumns = checked
      ? [...visibleDataColumns, column]
      : visibleDataColumns.filter((item) => item !== column);
    const tableKey = getMysqlOpenedTableKey(activeOpenedTable.database, activeOpenedTable.table);
    saveTableDataCache(tableKey, null);
    updateOpenedTableVisibleColumns(activeOpenedTable.database, activeOpenedTable.table, nextColumns);
    await fetchData(activeOpenedTable.database, activeOpenedTable.table, 1, dataState.pageSize);
  }, [activeOpenedTable, updateOpenedTableVisibleColumns, visibleDataColumns, saveTableDataCache, fetchData, dataState.pageSize]);

  const handleSelectAllVisibleColumns = useCallback(async () => {
    if (!activeOpenedTable) return;
    const tableKey = getMysqlOpenedTableKey(activeOpenedTable.database, activeOpenedTable.table);
    saveTableDataCache(tableKey, null);
    updateOpenedTableVisibleColumns(activeOpenedTable.database, activeOpenedTable.table, dataState.columns);
    await fetchData(activeOpenedTable.database, activeOpenedTable.table, 1, dataState.pageSize);
  }, [activeOpenedTable, dataState.columns, updateOpenedTableVisibleColumns, saveTableDataCache, fetchData, dataState.pageSize]);

  const applyFilter = useCallback(async (tree: FilterGroupDraft | null) => {
    if (!activeOpenedTable) return;
    const sanitizedTree = tree ? sanitizeFilterNode(tree) : null;

    const tableKey = getMysqlOpenedTableKey(activeOpenedTable.database, activeOpenedTable.table);
    saveTableDataCache(tableKey, null);

    updateOpenedTableQueryState(activeOpenedTable.database, activeOpenedTable.table, {
      filterTree: sanitizedTree?.kind === "group" ? sanitizedTree : undefined
    });
    await fetchData(activeOpenedTable.database, activeOpenedTable.table, 1, dataState.pageSize, {
      filterTree: sanitizedTree?.kind === "group" ? sanitizedTree : undefined
    });
  }, [activeOpenedTable, dataState.pageSize, fetchData, updateOpenedTableQueryState, saveTableDataCache]);

  const clearFilter = useCallback(async () => {
    if (!activeOpenedTable) return;
    const tableKey = getMysqlOpenedTableKey(activeOpenedTable.database, activeOpenedTable.table);
    saveTableDataCache(tableKey, null);

    updateOpenedTableQueryState(activeOpenedTable.database, activeOpenedTable.table, {
      filterTree: undefined
    });
    syncFilterDraftFromOpenedTable({ ...activeOpenedTable, filterTree: undefined }, dataState.columns);
    await fetchData(activeOpenedTable.database, activeOpenedTable.table, 1, dataState.pageSize, {
      filterTree: undefined
    });
  }, [activeOpenedTable, dataState.columns, dataState.pageSize, fetchData, syncFilterDraftFromOpenedTable, updateOpenedTableQueryState, saveTableDataCache]);

  const applySort = useCallback(async (column: string, direction: "asc" | "desc") => {
    if (!activeOpenedTable) return;
    const tableKey = getMysqlOpenedTableKey(activeOpenedTable.database, activeOpenedTable.table);
    saveTableDataCache(tableKey, null);

    updateOpenedTableQueryState(activeOpenedTable.database, activeOpenedTable.table, {
      sortColumn: column,
      sortDirection: direction
    });
    setSortModalOpen(false);
    await fetchData(activeOpenedTable.database, activeOpenedTable.table, 1, dataState.pageSize, {
      sortColumn: column,
      sortDirection: direction
    });
  }, [activeOpenedTable, dataState.pageSize, fetchData, setSortModalOpen, updateOpenedTableQueryState, saveTableDataCache]);

  const clearSort = useCallback(async () => {
    if (!activeOpenedTable) return;
    const tableKey = getMysqlOpenedTableKey(activeOpenedTable.database, activeOpenedTable.table);
    saveTableDataCache(tableKey, null);

    updateOpenedTableQueryState(activeOpenedTable.database, activeOpenedTable.table, {
      sortColumn: undefined,
      sortDirection: undefined
    });
    setSortModalOpen(false);
    await fetchData(activeOpenedTable.database, activeOpenedTable.table, 1, dataState.pageSize, {
      sortColumn: undefined,
      sortDirection: undefined
    });
  }, [activeOpenedTable, dataState.pageSize, fetchData, setSortModalOpen, updateOpenedTableQueryState, saveTableDataCache]);

  const handleToggleFilterPanel = useCallback(() => {
    const firstColumn = dataState.columns[0] ?? "";
    const tree = filterDraftTree
      ? filterDraftTree
      : createFilterGroup("and", [createFilterCondition(firstColumn)]);
    setFilterDraftTree(tree);
    setFilterPanelOpen((prev) => !prev);
  }, [dataState.columns, filterDraftTree, setFilterDraftTree, setFilterPanelOpen]);

  const handleOpenSortModal = useCallback(() => {
    setSortDraft({
      column: activeOpenedTable?.sortColumn ?? dataState.columns[0] ?? "",
      direction: activeOpenedTable?.sortDirection ?? "asc"
    });
    setSortModalOpen(true);
  }, [activeOpenedTable?.sortColumn, activeOpenedTable?.sortDirection, dataState.columns, setSortDraft, setSortModalOpen]);

  const copyToClipboard = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      logError(err, {
        source: "useTableDataActions.copyClipboard",
        message: "Failed to copy content to clipboard"
      });
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [setError]);

  return {
    syncFilterDraftFromOpenedTable,
    fetchData,
    totalPages,
    handlePageChange,
    handlePageSizeChange,
    copyToClipboard,
    visibleDataColumns,
    handleVisibleColumnToggle,
    handleSelectAllVisibleColumns,
    applyFilter,
    clearFilter,
    applySort,
    clearSort,
    handleToggleFilterPanel,
    handleOpenSortModal,
  };
}
