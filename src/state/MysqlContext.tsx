import type { Dispatch, ReactNode, SetStateAction } from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { MysqlConnection, MysqlOpenedTable, MysqlTableDataCacheEntry, SqlQueryState } from "../modules/mysql/types";
import { useSharedConnectionState } from "./SharedConnectionState";

export interface MysqlWorkspaceState {
  databases: string[];
  tablesByDb: Record<string, string[]>;
  expandedDatabase: string | null;
  selectedDatabase: string | undefined;
  selectedTable: string | undefined;
  openedTables: MysqlOpenedTable[];
  activeOpenedTableKey: string | null;
  tableDataCache: Record<string, MysqlTableDataCacheEntry>;
}

const defaultWorkspace: MysqlWorkspaceState = {
  databases: [],
  tablesByDb: {},
  expandedDatabase: null,
  selectedDatabase: undefined,
  selectedTable: undefined,
  openedTables: [],
  activeOpenedTableKey: null,
  tableDataCache: {},
};

interface MysqlContextValue {
  activeMysqlConnection: MysqlConnection | null;
  databases: string[];
  setDatabases: (dbs: string[]) => void;
  tablesByDb: Record<string, string[]>;
  setTablesByDb: Dispatch<SetStateAction<Record<string, string[]>>>;
  expandedDatabase: string | null;
  setExpandedDatabase: (db: string | null) => void;
  selectedDatabase: string | undefined;
  setSelectedDatabase: (db: string | undefined) => void;
  selectedTable: string | undefined;
  setSelectedTable: (table: string | undefined) => void;
  openedTables: MysqlOpenedTable[];
  setOpenedTables: Dispatch<SetStateAction<MysqlOpenedTable[]>>;
  activeOpenedTableKey: string | null;
  setActiveOpenedTableKey: (key: string | null) => void;
  getMysqlConnectionById: (id: string) => MysqlConnection | null;
  sqlQueryStates: Record<string, SqlQueryState>;
  updateSqlQueryState: (connectionId: string, state: Partial<SqlQueryState>) => void;
  getSqlQueryState: (connectionId: string) => SqlQueryState;
  // Per-connection workspace access
  getWorkspaceForConnection: (id: string) => MysqlWorkspaceState;
  resetWorkspaceForConnection: (id: string) => void;
  setDatabasesForConnection: (id: string, dbs: string[]) => void;
  // Per-table data cache (session-only)
  saveTableDataCache: (tableKey: string, entry: MysqlTableDataCacheEntry | null) => void;
  getTableDataCache: () => Record<string, MysqlTableDataCacheEntry>;
}

const MysqlContext = createContext<MysqlContextValue | null>(null);

export function MysqlProvider({ children }: { children: ReactNode }) {
  const { profiles, getSecretById, getFocusedConnectionIdByEngine, focusedConnectionIdRef } = useSharedConnectionState();
  const [workspaceByConnection, setWorkspaceByConnection] = useState<Record<string, MysqlWorkspaceState>>({});
  const [sqlQueryStates, setSqlQueryStates] = useState<Record<string, SqlQueryState>>({});

  const getMysqlConnectionById = useCallback(
    (id: string): MysqlConnection | null => {
      const profile = profiles.find((p) => p.id === id);
      if (!profile || profile.engine !== "mysql") return null;
      const secret = getSecretById(id);
      return {
        id: profile.id,
        name: profile.name,
        engine: profile.engine,
        host: profile.mysqlHost ?? "127.0.0.1",
        port: profile.mysqlPort ?? 3306,
        database: profile.mysqlDatabase,
        username: secret.username,
        password: secret.password,
        ssh: profile.ssh,
        sshPassword: secret.sshPassword,
      };
    },
    [getSecretById, profiles]
  );

  const focusedConnectionId = getFocusedConnectionIdByEngine("mysql");

  const activeMysqlConnection = useMemo(() => {
    if (!focusedConnectionId) return null;
    return getMysqlConnectionById(focusedConnectionId);
  }, [focusedConnectionId, getMysqlConnectionById]);

  const focusedWorkspace = useMemo(() => {
    if (!focusedConnectionId) return defaultWorkspace;
    return workspaceByConnection[focusedConnectionId] ?? defaultWorkspace;
  }, [focusedConnectionId, workspaceByConnection]);

  // Flat field accessors pointing to focused workspace.
  // Use the ref to read the focused connection ID at call time, not at render time.
  const getFocusedId = useCallback(() => focusedConnectionIdRef.current.mysql, [focusedConnectionIdRef]);

  const setDatabases = useCallback((dbs: string[]) => {
    const id = getFocusedId();
    if (!id) return;
    setWorkspaceByConnection((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? defaultWorkspace),
        databases: dbs,
      },
    }));
  }, [getFocusedId]);

  const setTablesByDb = useCallback((updater: SetStateAction<Record<string, string[]>>) => {
    const id = getFocusedId();
    if (!id) return;
    setWorkspaceByConnection((prev) => {
      const current = prev[id] ?? defaultWorkspace;
      const nextTables = typeof updater === "function" ? updater(current.tablesByDb) : updater;
      return {
        ...prev,
        [id]: { ...current, tablesByDb: nextTables },
      };
    });
  }, [getFocusedId]);

  const setExpandedDatabase = useCallback((db: string | null) => {
    const id = getFocusedId();
    if (!id) return;
    setWorkspaceByConnection((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? defaultWorkspace),
        expandedDatabase: db,
      },
    }));
  }, [getFocusedId]);

  const setSelectedDatabase = useCallback((db: string | undefined) => {
    const id = getFocusedId();
    if (!id) return;
    setWorkspaceByConnection((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? defaultWorkspace),
        selectedDatabase: db,
      },
    }));
  }, [getFocusedId]);

  const setSelectedTable = useCallback((table: string | undefined) => {
    const id = getFocusedId();
    if (!id) return;
    setWorkspaceByConnection((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? defaultWorkspace),
        selectedTable: table,
      },
    }));
  }, [getFocusedId]);

  const setOpenedTables = useCallback((updater: SetStateAction<MysqlOpenedTable[]>) => {
    const id = getFocusedId();
    if (!id) return;
    setWorkspaceByConnection((prev) => {
      const current = prev[id] ?? defaultWorkspace;
      const nextTables = typeof updater === "function" ? updater(current.openedTables) : updater;
      return {
        ...prev,
        [id]: { ...current, openedTables: nextTables },
      };
    });
  }, [getFocusedId]);

  const setDatabasesForConnection = useCallback((id: string, dbs: string[]) => {
    setWorkspaceByConnection((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? defaultWorkspace),
        databases: dbs,
      },
    }));
  }, []);

  const setActiveOpenedTableKey = useCallback((key: string | null) => {
    const id = getFocusedId();
    if (!id) return;
    setWorkspaceByConnection((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? defaultWorkspace),
        activeOpenedTableKey: key,
      },
    }));
  }, [getFocusedId]);

  const getWorkspaceForConnection = useCallback(
    (id: string) => workspaceByConnection[id] ?? defaultWorkspace,
    [workspaceByConnection]
  );

  const resetWorkspaceForConnection = useCallback((id: string) => {
    setWorkspaceByConnection((prev) => ({
      ...prev,
      [id]: defaultWorkspace,
    }));
  }, []);

  const saveTableDataCache = useCallback((tableKey: string, entry: MysqlTableDataCacheEntry | null) => {
    const id = getFocusedId();
    if (!id) return;
    setWorkspaceByConnection((prev) => {
      const current = prev[id] ?? defaultWorkspace;
      const nextCache = { ...current.tableDataCache };
      if (entry === null) {
        delete nextCache[tableKey];
      } else {
        nextCache[tableKey] = entry;
      }
      return {
        ...prev,
        [id]: { ...current, tableDataCache: nextCache },
      };
    });
  }, [getFocusedId]);

  const getTableDataCache = useCallback(() => {
    const id = getFocusedId();
    if (!id) return {};
    return workspaceByConnection[id]?.tableDataCache ?? {};
  }, [getFocusedId, workspaceByConnection]);

  const updateSqlQueryState = useCallback(
    (connectionId: string, updates: Partial<SqlQueryState>) => {
      setSqlQueryStates((prev) => {
        const current = prev[connectionId] ?? { sql: "", results: [] };
        return {
          ...prev,
          [connectionId]: { ...current, ...updates },
        };
      });
    },
    []
  );

  const getSqlQueryState = useCallback(
    (connectionId: string): SqlQueryState => {
      return sqlQueryStates[connectionId] ?? { sql: "", results: [] };
    },
    [sqlQueryStates]
  );

  const value = useMemo(
    () => ({
      activeMysqlConnection,
      databases: focusedWorkspace.databases,
      setDatabases,
      tablesByDb: focusedWorkspace.tablesByDb,
      setTablesByDb,
      expandedDatabase: focusedWorkspace.expandedDatabase,
      setExpandedDatabase,
      selectedDatabase: focusedWorkspace.selectedDatabase,
      setSelectedDatabase,
      selectedTable: focusedWorkspace.selectedTable,
      setSelectedTable,
      openedTables: focusedWorkspace.openedTables,
      setOpenedTables,
      activeOpenedTableKey: focusedWorkspace.activeOpenedTableKey,
      setActiveOpenedTableKey,
      getMysqlConnectionById,
      sqlQueryStates,
      updateSqlQueryState,
      getSqlQueryState,
      getWorkspaceForConnection,
      resetWorkspaceForConnection,
      setDatabasesForConnection,
      saveTableDataCache,
      getTableDataCache,
    }),
    [
      activeMysqlConnection,
      focusedWorkspace,
      setDatabases,
      setTablesByDb,
      setExpandedDatabase,
      setSelectedDatabase,
      setSelectedTable,
      setOpenedTables,
      setActiveOpenedTableKey,
      getMysqlConnectionById,
      sqlQueryStates,
      updateSqlQueryState,
      getSqlQueryState,
      getWorkspaceForConnection,
      resetWorkspaceForConnection,
      setDatabasesForConnection,
      saveTableDataCache,
      getTableDataCache,
    ]
  );

  return <MysqlContext.Provider value={value}>{children}</MysqlContext.Provider>;
}

export function useMysqlContext() {
  const ctx = useContext(MysqlContext);
  if (!ctx) throw new Error("MysqlContext not initialized");
  return ctx;
}
