import type { Dispatch, ReactNode, SetStateAction } from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { MysqlConnection, MysqlOpenedTable, SqlQueryState } from "../modules/mysql/types";
import { useSharedConnectionState } from "./SharedConnectionState";

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
}

const MysqlContext = createContext<MysqlContextValue | null>(null);

export function MysqlProvider({ children }: { children: ReactNode }) {
  const { profiles, getSecretById, getActiveConnectionIdByEngine } = useSharedConnectionState();
  const [databases, setDatabases] = useState<string[]>([]);
  const [tablesByDb, setTablesByDb] = useState<Record<string, string[]>>({});
  const [expandedDatabase, setExpandedDatabase] = useState<string | null>(null);
  const [selectedDatabase, setSelectedDatabase] = useState<string | undefined>();
  const [selectedTable, setSelectedTable] = useState<string | undefined>();
  const [openedTables, setOpenedTables] = useState<MysqlOpenedTable[]>([]);
  const [activeOpenedTableKey, setActiveOpenedTableKey] = useState<string | null>(null);
  const [sqlQueryStates, setSqlQueryStates] = useState<Record<string, SqlQueryState>>({});

  // Context keeps shared runtime state only; MySQL domain types now live in src/modules/mysql/types.ts.
  const defaultSqlQueryState: SqlQueryState = {
    sql: "",
    results: []
  };

  const getSqlQueryState = useCallback(
    (connectionId: string): SqlQueryState => {
      return sqlQueryStates[connectionId] ?? defaultSqlQueryState;
    },
    [sqlQueryStates]
  );

  const updateSqlQueryState = useCallback(
    (connectionId: string, updates: Partial<SqlQueryState>) => {
      setSqlQueryStates((prev) => {
        const current = prev[connectionId] ?? defaultSqlQueryState;
        return {
          ...prev,
          [connectionId]: {
            ...current,
            ...updates
          }
        };
      });
    },
    []
  );

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

  const activeMysqlConnection = useMemo(() => {
    const activeConnectionId = getActiveConnectionIdByEngine("mysql");
    if (!activeConnectionId) return null;
    return getMysqlConnectionById(activeConnectionId);
  }, [getActiveConnectionIdByEngine, getMysqlConnectionById]);

  const value = useMemo(
    () => ({
      activeMysqlConnection,
      databases,
      setDatabases,
      tablesByDb,
      setTablesByDb,
      expandedDatabase,
      setExpandedDatabase,
      selectedDatabase,
      setSelectedDatabase,
      selectedTable,
      setSelectedTable,
      openedTables,
      setOpenedTables,
      activeOpenedTableKey,
      setActiveOpenedTableKey,
      getMysqlConnectionById,
      sqlQueryStates,
      updateSqlQueryState,
      getSqlQueryState
    }),
    [
      activeMysqlConnection,
      databases,
      tablesByDb,
      expandedDatabase,
      selectedDatabase,
      selectedTable,
      openedTables,
      activeOpenedTableKey,
      getMysqlConnectionById,
      sqlQueryStates,
      updateSqlQueryState,
      getSqlQueryState
    ]
  );

  return <MysqlContext.Provider value={value}>{children}</MysqlContext.Provider>;
}

export function useMysqlContext() {
  const ctx = useContext(MysqlContext);
  if (!ctx) throw new Error("MysqlContext not initialized");
  return ctx;
}
