import { useCallback } from "react";
import { logError } from "../../../../../lib/errorLog";
import { getMysqlOpenedTableKey, type MysqlOpenedTable, type MysqlTableDataCacheEntry } from "../../../types";
import { mysqlListDatabases, mysqlListTables } from "../../../services/queryClient";
import type { ColumnMeta } from "../../../types";
import { fetchTableDetailSnapshot } from "../services/tableSchemaService";
import {
    defaultDataState,
    escapeSqlLiteral,
    formatInfoDate,
    formatInfoText,
    getSingleResultRow,
    toSafeNumber,
    type DataState,
    type RightPanelTab,
    type TableDetailInfo,
    type TableInfo,
} from "../utils";

interface UseTableLifecycleActionsProps {
  connectionId: string | null | undefined;
  expandedDatabase: string | null;
  openedTables: MysqlOpenedTable[];
  activeOpenedTableKey: string | null;
  locationPathname: string;
  selectedTableInfo: TableInfo | null;
  selectedDatabase: string | undefined;
  selectedTable: string | undefined;
  navigate: (to: string) => void | Promise<void>;
  setLoading: (loading: boolean) => void;
  setDatabases: (databases: string[]) => void;
  setTablesByDb: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  setExpandedDatabase: (database: string | null) => void;
  setSelectedDatabase: (database: string | undefined) => void;
  setSelectedTable: (table: string | undefined) => void;
  setOpenedTables: React.Dispatch<React.SetStateAction<MysqlOpenedTable[]>>;
  setActiveOpenedTableKey: (key: string | null) => void;
  setSelectedTableInfo: (info: TableInfo | null) => void;
  setDataState: React.Dispatch<React.SetStateAction<DataState>>;
  setDataColumnMeta: (columns: ColumnMeta[]) => void;
  setSelectedOverviewTables: React.Dispatch<React.SetStateAction<string[]>>;
  setOverviewSelectionAnchor: React.Dispatch<React.SetStateAction<string | null>>;
  setRightPanelTab: (tab: RightPanelTab) => void;
  setError: (message: string) => void;
  fetchData: (db?: string, table?: string, page?: number, pageSize?: number, overrides?: Partial<Pick<MysqlOpenedTable, "filterTree" | "sortColumn" | "sortDirection">>) => Promise<void>;
  latestDataRequestRef: React.MutableRefObject<number>;
  activeDataRequestKeyRef: React.MutableRefObject<string | null>;
  saveTableDataCache: (tableKey: string, entry: MysqlTableDataCacheEntry | null) => void;
  currentLoadingTableKeyRef: React.MutableRefObject<string | null>;
}

export function useTableLifecycleActions({
  connectionId,
  expandedDatabase,
  openedTables,
  activeOpenedTableKey,
  locationPathname,
  selectedTableInfo,
  selectedDatabase,
  selectedTable,
  navigate,
  setLoading,
  setDatabases,
  setTablesByDb,
  setExpandedDatabase,
  setSelectedDatabase,
  setSelectedTable,
  setOpenedTables,
  setActiveOpenedTableKey,
  setSelectedTableInfo,
  setDataState,
  setDataColumnMeta,
  setSelectedOverviewTables,
  setOverviewSelectionAnchor,
  setRightPanelTab,
  setError,
  fetchData,
  latestDataRequestRef,
  activeDataRequestKeyRef,
  saveTableDataCache,
  currentLoadingTableKeyRef,
}: UseTableLifecycleActionsProps) {
  const refreshDatabases = useCallback(async () => {
    if (!connectionId) return;
    setLoading(true);
    try {
      const dbs = await mysqlListDatabases(connectionId);
      setDatabases(dbs);
      setTablesByDb((prev) => {
        const next: Record<string, string[]> = {};
        dbs.forEach((db) => {
          if (prev[db]) {
            next[db] = prev[db];
          }
        });
        return next;
      });
      if (expandedDatabase && !dbs.includes(expandedDatabase)) {
        setExpandedDatabase(null);
        setSelectedDatabase(undefined);
        setSelectedTable(undefined);
        setSelectedTableInfo(null);
        setDataState(defaultDataState);
      }
      const remainingOpenedTables = openedTables.filter((item) => dbs.includes(item.database));
      if (remainingOpenedTables.length !== openedTables.length) {
        setOpenedTables(remainingOpenedTables);
        const nextActiveKey = activeOpenedTableKey && remainingOpenedTables.some((item) => getMysqlOpenedTableKey(item.database, item.table) === activeOpenedTableKey)
          ? activeOpenedTableKey
          : null;
        setActiveOpenedTableKey(nextActiveKey);
        setSelectedTableInfo(null);
        setDataState(defaultDataState);
        if (locationPathname === "/mysql/table") {
          const hasActive = activeOpenedTableKey && remainingOpenedTables.some((item) => getMysqlOpenedTableKey(item.database, item.table) === activeOpenedTableKey);
          if (!hasActive) {
            void navigate("/mysql/tables");
          }
        }
      }
    } catch (err) {
      logError(err, {
        source: "useTableLifecycleActions.refreshDatabases",
        message: "Failed to refresh MySQL database tree"
      });
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [activeOpenedTableKey, connectionId, expandedDatabase, locationPathname, navigate, openedTables, setActiveOpenedTableKey, setDataState, setDatabases, setError, setExpandedDatabase, setLoading, setOpenedTables, setSelectedDatabase, setSelectedTable, setSelectedTableInfo, setTablesByDb]);

  const refreshTablesForDb = useCallback(async (db: string) => {
    if (!connectionId) return;
    try {
      const tbls = await mysqlListTables(connectionId, db);
      setTablesByDb((prev) => ({ ...prev, [db]: tbls }));
      if (expandedDatabase === db) {
        setSelectedOverviewTables((previous) => previous.filter((table) => tbls.includes(table)));
        setOverviewSelectionAnchor((previous) => (previous && tbls.includes(previous) ? previous : null));
      }
      if (selectedTableInfo?.database === db && selectedTableInfo.table && !tbls.includes(selectedTableInfo.table)) {
        setSelectedTableInfo(null);
        setDataState(defaultDataState);
      }
      if (selectedDatabase === db && selectedTable && !tbls.includes(selectedTable)) {
        setSelectedTable(undefined);
      }
      const remainingOpenedTables = openedTables.filter((item) => item.database !== db || tbls.includes(item.table));
      if (remainingOpenedTables.length !== openedTables.length) {
        setOpenedTables(remainingOpenedTables);
        const nextActiveKey = activeOpenedTableKey && remainingOpenedTables.some((item) => getMysqlOpenedTableKey(item.database, item.table) === activeOpenedTableKey)
          ? activeOpenedTableKey
          : null;
        setActiveOpenedTableKey(nextActiveKey);
        setSelectedTableInfo(null);
        setDataState(defaultDataState);
        if (locationPathname === "/mysql/table") {
          const hasActive = activeOpenedTableKey && remainingOpenedTables.some((item) => getMysqlOpenedTableKey(item.database, item.table) === activeOpenedTableKey);
          if (!hasActive) {
            void navigate("/mysql/tables");
          }
        }
      }
    } catch (error) {
      logError(error, {
        source: "useTableLifecycleActions.refreshTables",
        message: `Failed to refresh tables for database ${db}`
      });
      setTablesByDb((prev) => ({ ...prev, [db]: [] }));
    }
  }, [activeOpenedTableKey, connectionId, expandedDatabase, locationPathname, navigate, openedTables, selectedDatabase, selectedTable, selectedTableInfo, setActiveOpenedTableKey, setDataState, setOpenedTables, setOverviewSelectionAnchor, setSelectedOverviewTables, setSelectedTable, setSelectedTableInfo, setTablesByDb]);

  const loadTableInfo = useCallback(async (db: string, table: string) => {
    const { columns, countResult, statusResult, createResult } = await fetchTableDetailSnapshot(
      connectionId!,
      db,
      table,
      escapeSqlLiteral(table)
    );

    const rowCount = countResult.isResultSet && countResult.rows.length > 0
      ? Number(countResult.rows[0][0]) || 0
      : 0;

    const statusRow = getSingleResultRow(statusResult.columns, statusResult.rows);
    const createTableRow = getSingleResultRow(createResult.columns, createResult.rows);
    const info: TableDetailInfo = {
      engine: formatInfoText(statusRow?.Engine),
      rowFormat: formatInfoText(statusRow?.Row_format),
      tableRows: toSafeNumber(statusRow?.Rows),
      autoIncrement: formatInfoText(statusRow?.Auto_increment),
      createTime: formatInfoDate(statusRow?.Create_time),
      updateTime: formatInfoDate(statusRow?.Update_time),
      checkTime: formatInfoDate(statusRow?.Check_time),
      collation: formatInfoText(statusRow?.Collation),
      indexLength: toSafeNumber(statusRow?.Index_length),
      dataLength: toSafeNumber(statusRow?.Data_length),
      maxDataLength: toSafeNumber(statusRow?.Max_data_length),
      dataFree: toSafeNumber(statusRow?.Data_free),
      avgRowLength: toSafeNumber(statusRow?.Avg_row_length),
      comment: formatInfoText(statusRow?.Comment),
      createOptions: formatInfoText(statusRow?.Create_options),
      createSql: formatInfoText(createTableRow?.["Create Table"])
    };

    return { columns, rowCount, info };
  }, [connectionId]);

  const handleOpenTable = useCallback(async (db: string, table: string, targetTab: RightPanelTab) => {
    if (!connectionId) return;

    const tableKey = getMysqlOpenedTableKey(db, table);
    const requestId = ++latestDataRequestRef.current;
    activeDataRequestKeyRef.current = targetTab === "data" ? tableKey : null;
    currentLoadingTableKeyRef.current = tableKey;

    setSelectedDatabase(db);
    setSelectedTable(table);
    setSelectedTableInfo({ database: db, table, columns: undefined, rowCount: 0, info: undefined, loading: true });
    setRightPanelTab(targetTab);
    setDataColumnMeta([]);
    setDataState(targetTab === "data" ? { ...defaultDataState, loading: true } : defaultDataState);

    try {
      const { columns, rowCount, info } = await loadTableInfo(db, table);

      // Request was superseded by a newer one (e.g., user clicked another table).
      // Reset loading state so the UI doesn't get stuck on a spinner.
      if (latestDataRequestRef.current !== requestId || currentLoadingTableKeyRef.current !== tableKey) {
        setSelectedTableInfo({ database: db, table, loading: false });
        setDataState((prev) => ({ ...prev, loading: false }));
        return;
      }

      setSelectedTableInfo({ database: db, table, columns, rowCount, info, loading: false });
      setDataColumnMeta(columns);

      if (targetTab === "data") {
        await fetchData(db, table, 1, defaultDataState.pageSize);
      } else {
        setDataState(defaultDataState);
        saveTableDataCache(tableKey, {
          columns: [],
          rows: [],
          total: 0,
          page: 1,
          pageSize: defaultDataState.pageSize,
          columnMeta: columns,
          tableInfo: { columns, rowCount, info },
          dataColumns: [],
          cachedAt: Date.now(),
        });
      }
    } catch (err) {
      if (latestDataRequestRef.current !== requestId || currentLoadingTableKeyRef.current !== tableKey) {
        setSelectedTableInfo({ database: db, table, loading: false });
        setDataState((prev) => ({ ...prev, loading: false }));
        return;
      }
      logError(err, {
        source: targetTab === "data" ? "useTableLifecycleActions.openTableData" : "useTableLifecycleActions.openTableStructure",
        message: `Failed to open table ${db}.${table}`
      });
      setSelectedTableInfo({ database: db, table, loading: false });
      setError(err instanceof Error ? err.message : String(err));
      setDataState(defaultDataState);
      activeDataRequestKeyRef.current = null;
    }
  }, [activeDataRequestKeyRef, connectionId, currentLoadingTableKeyRef, fetchData, latestDataRequestRef, loadTableInfo, setDataColumnMeta, setDataState, setError, setRightPanelTab, setSelectedDatabase, setSelectedTable, setSelectedTableInfo, saveTableDataCache]);

  const setOpenedTableView = useCallback((db: string, table: string, view: RightPanelTab) => {
    const nextKey = getMysqlOpenedTableKey(db, table);
    setOpenedTables((prev) => prev.map((item) => (
      getMysqlOpenedTableKey(item.database, item.table) === nextKey ? { ...item, view } : item
    )));
  }, [setOpenedTables]);

  return {
    refreshDatabases,
    refreshTablesForDb,
    handleOpenTable,
    setOpenedTableView,
  };
}
