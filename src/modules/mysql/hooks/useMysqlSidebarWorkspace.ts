import { useEffect, useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { logError } from "../../../lib/errorLog";
import type { ConnectionProfile } from "../../../lib/types";
import { getMysqlOpenedTableKey, useMysqlContext } from "../../../state/MysqlContext";
import {
    mysqlExportDatabase,
    mysqlExportTable,
    mysqlImportSql,
    mysqlListDatabases,
    mysqlListTables,
    mysqlQuery,
} from "../services/client";

interface DatabaseMenuState {
  database: string;
  x: number;
  y: number;
}

interface TableMenuState {
  database: string;
  table: string;
  x: number;
  y: number;
}

interface TabMenuState {
  key: string;
  x: number;
  y: number;
}

interface UseMysqlSidebarWorkspaceOptions {
  activeConnectionId?: string;
  getProfileById: (connectionId?: string | null) => ConnectionProfile | null;
  ensureMysqlConnectionReady: (connectionId: string) => Promise<boolean>;
  setConnectionActionError: (message: string) => void;
}

export function useMysqlSidebarWorkspace({
  activeConnectionId,
  getProfileById,
  ensureMysqlConnectionReady,
  setConnectionActionError,
}: UseMysqlSidebarWorkspaceOptions) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const {
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
  } = useMysqlContext();

  const [sidebarExpandedTablesDatabase, setSidebarExpandedTablesDatabase] = useState<string | null>(null);
  const [mysqlDatabaseContextMenu, setMysqlDatabaseContextMenu] = useState<DatabaseMenuState | null>(null);
  const [mysqlTableContextMenu, setMysqlTableContextMenu] = useState<TableMenuState | null>(null);
  const [mysqlTabContextMenu, setMysqlTabContextMenu] = useState<TabMenuState | null>(null);

  const closeMysqlMenus = () => {
    setMysqlDatabaseContextMenu(null);
    setMysqlTableContextMenu(null);
    setMysqlTabContextMenu(null);
  };

  useEffect(() => {
    const activeProfile = getProfileById(activeConnectionId);
    if (activeProfile?.engine === "mysql") {
      return;
    }

    setSidebarExpandedTablesDatabase(null);
    closeMysqlMenus();
  }, [activeConnectionId, getProfileById]);

  const refreshMysqlDatabases = async () => {
    if (!activeConnectionId) {
      return;
    }

    const profile = getProfileById(activeConnectionId);
    if (profile?.engine !== "mysql") {
      return;
    }

    try {
      const nextDatabases = await mysqlListDatabases(activeConnectionId);
      setDatabases(nextDatabases);
    } catch (error) {
      logError(error, {
        source: "app.mysql.refreshDatabases",
        message: "Failed to refresh MySQL databases from sidebar",
      });
      setDatabases([]);
    }
  };

  const loadMysqlTables = async (database: string) => {
    if (!activeConnectionId) {
      return;
    }

    const profile = getProfileById(activeConnectionId);
    if (profile?.engine !== "mysql") {
      return;
    }

    try {
      const tables = await mysqlListTables(activeConnectionId, database);
      setTablesByDb((prev) => ({
        ...prev,
        [database]: tables,
      }));
    } catch (error) {
      logError(error, {
        source: "app.mysql.listTables",
        message: `Failed to load tables for database ${database}`,
      });
      setTablesByDb((prev) => ({
        ...prev,
        [database]: [],
      }));
    }
  };

  const handleMysqlSelectDatabase = (database: string) => {
    setSelectedDatabase(database);
    setSelectedTable(undefined);
  };

  const handleMysqlOpenDatabase = async (database: string) => {
    setExpandedDatabase(database);
    setSelectedDatabase(database);
    setSelectedTable(undefined);
    if (!tablesByDb[database]) {
      await loadMysqlTables(database);
    }
    await navigate("/mysql/tables");
  };

  const handleMysqlCloseDatabase = async (database: string) => {
    if (expandedDatabase !== database) {
      return;
    }

    setExpandedDatabase(null);
    setSelectedTable(undefined);
    setSidebarExpandedTablesDatabase((prev) => (prev === database ? null : prev));

    const remainingTables = openedTables.filter((item) => item.database !== database);
    setOpenedTables(remainingTables);

    const nextActive = activeOpenedTableKey
      ? remainingTables.find((item) => getMysqlOpenedTableKey(item.database, item.table) === activeOpenedTableKey)
        ?? remainingTables[remainingTables.length - 1]
        ?? null
      : null;
    setActiveOpenedTableKey(nextActive ? getMysqlOpenedTableKey(nextActive.database, nextActive.table) : null);
    await navigate("/mysql/tables");
  };

  const handleMysqlToggleSidebarTables = async (database: string) => {
    setSelectedDatabase(database);

    if (expandedDatabase !== database) {
      await handleMysqlOpenDatabase(database);
    } else if (!tablesByDb[database]) {
      await loadMysqlTables(database);
    }

    setSidebarExpandedTablesDatabase((prev) => (prev === database ? null : database));
  };

  const handleMysqlSelectSidebarTable = async (database: string, table: string) => {
    setSelectedDatabase(database);
    setSelectedTable(table);
    if (location.pathname === "/mysql/table") {
      return;
    }
    if (location.pathname !== "/mysql/tables") {
      await navigate("/mysql/tables");
    }
  };

  const handleMysqlOpenSidebarTable = async (database: string, table: string) => {
    const nextKey = getMysqlOpenedTableKey(database, table);
    setSelectedDatabase(database);
    setSelectedTable(table);
    setOpenedTables((prev) => {
      const existing = prev.find((item) => getMysqlOpenedTableKey(item.database, item.table) === nextKey);
      if (existing) {
        return prev.map((item) => (
          getMysqlOpenedTableKey(item.database, item.table) === nextKey
            ? { ...item, view: "data" }
            : item
        ));
      }

      return [...prev, { database, table, view: "data" }];
    });
    setActiveOpenedTableKey(nextKey);
    await navigate("/mysql/table");
  };

  const handleActivateMysqlOpenedTable = async (database: string, table: string) => {
    const nextKey = getMysqlOpenedTableKey(database, table);
    setSelectedDatabase(database);
    setSelectedTable(table);
    setActiveOpenedTableKey(nextKey);
    await navigate("/mysql/table");
  };

  const handleCloseMysqlOpenedTable = async (database: string, table: string) => {
    const targetKey = getMysqlOpenedTableKey(database, table);
    const remainingTables = openedTables.filter((item) => getMysqlOpenedTableKey(item.database, item.table) !== targetKey);
    setOpenedTables(remainingTables);

    if (selectedDatabase === database && selectedTable === table) {
      setSelectedTable(undefined);
    }

    if (activeOpenedTableKey === targetKey) {
      const nextActive = remainingTables[remainingTables.length - 1] ?? null;
      if (!nextActive) {
        setActiveOpenedTableKey(null);
        await navigate("/mysql/tables");
        return;
      }

      setActiveOpenedTableKey(getMysqlOpenedTableKey(nextActive.database, nextActive.table));
      setSelectedDatabase(nextActive.database);
      setSelectedTable(nextActive.table);
      await navigate(`/mysql/table${location.search || "?tab=data"}`);
      return;
    }

    const nextActiveKey = activeOpenedTableKey && remainingTables.some((item) => getMysqlOpenedTableKey(item.database, item.table) === activeOpenedTableKey)
      ? activeOpenedTableKey
      : null;
    setActiveOpenedTableKey(nextActiveKey);
  };

  const handleMysqlTabContextMenu = (event: MouseEvent<HTMLButtonElement>, key: string) => {
    event.preventDefault();
    event.stopPropagation();
    setMysqlTabContextMenu({ key, x: event.clientX, y: event.clientY });
  };

  const handleMysqlTableContextMenu = (event: MouseEvent<HTMLDivElement>, database: string, table: string) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedDatabase(database);
    setSelectedTable(table);
    setMysqlTableContextMenu({ database, table, x: event.clientX, y: event.clientY });
  };

  const handleMysqlDatabaseContextMenu = (event: MouseEvent<HTMLDivElement>, database: string) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedDatabase(database);
    setMysqlDatabaseContextMenu({ database, x: event.clientX, y: event.clientY });
  };

  const closeCurrentMysqlTab = async (key: string) => {
    const target = openedTables.find((item) => getMysqlOpenedTableKey(item.database, item.table) === key);
    setMysqlTabContextMenu(null);
    if (!target) {
      return;
    }
    await handleCloseMysqlOpenedTable(target.database, target.table);
  };

  const closeOtherMysqlTabs = async (key: string) => {
    const keep = openedTables.find((item) => getMysqlOpenedTableKey(item.database, item.table) === key) ?? null;
    setMysqlTabContextMenu(null);
    if (!keep) {
      return;
    }

    setOpenedTables([keep]);
    setActiveOpenedTableKey(key);
    setSelectedDatabase(keep.database);
    setSelectedTable(keep.table);
    if (location.pathname === "/mysql/table") {
      await navigate("/mysql/table");
    }
  };

  const closeAllMysqlTabs = async () => {
    setMysqlTabContextMenu(null);
    setOpenedTables([]);
    setActiveOpenedTableKey(null);
    if (location.pathname === "/mysql/table") {
      await navigate("/mysql/tables");
    }
  };

  const handleCreateMysqlDatabase = async (connectionId: string) => {
    const ready = await ensureMysqlConnectionReady(connectionId);
    if (!ready) {
      return;
    }

    const nextName = window.prompt(t("mysql.tableManager.createDatabasePrompt"), "new_database")?.trim();
    if (!nextName) {
      return;
    }

    try {
      await mysqlQuery(connectionId, `CREATE DATABASE \`${nextName}\``);
      await refreshMysqlDatabases();
      setSelectedDatabase(nextName);
    } catch (error) {
      logError(error, {
        source: "app.mysql.createDatabase",
        message: `Failed to create database ${nextName}`,
      });
      setConnectionActionError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleDropMysqlDatabase = async (database: string) => {
    if (!activeConnectionId) {
      return;
    }
    if (!window.confirm(t("mysql.tableManager.dropDatabaseConfirm", { name: database }))) {
      return;
    }

    try {
      await mysqlQuery(activeConnectionId, `DROP DATABASE \`${database}\``);
      if (expandedDatabase === database) {
        setExpandedDatabase(null);
      }

      setSidebarExpandedTablesDatabase((prev) => (prev === database ? null : prev));
      if (selectedDatabase === database) {
        setSelectedDatabase(undefined);
        setSelectedTable(undefined);
      }

      const remainingTables = openedTables.filter((item) => item.database !== database);
      const didRemoveActiveTable = Boolean(
        activeOpenedTableKey &&
        openedTables.some((item) => item.database === database && getMysqlOpenedTableKey(item.database, item.table) === activeOpenedTableKey)
      );
      setOpenedTables(remainingTables);
      if (didRemoveActiveTable) {
        const nextActive = remainingTables[remainingTables.length - 1] ?? null;
        setActiveOpenedTableKey(nextActive ? getMysqlOpenedTableKey(nextActive.database, nextActive.table) : null);
        if (!nextActive && location.pathname === "/mysql/table") {
          await navigate("/mysql/tables");
        }
      }

      setTablesByDb((prev) => {
        const next = { ...prev };
        delete next[database];
        return next;
      });
      await refreshMysqlDatabases();
    } catch (error) {
      logError(error, {
        source: "app.mysql.dropDatabase",
        message: `Failed to drop database ${database}`,
      });
      setConnectionActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setMysqlDatabaseContextMenu(null);
    }
  };

  const handleMysqlExportDatabase = async (database: string, includeData: boolean) => {
    if (!activeConnectionId) {
      return;
    }
    try {
      const message = await mysqlExportDatabase(activeConnectionId, database, includeData);
      if (message) {
        window.alert(message);
      }
    } catch (error) {
      logError(error, {
        source: "app.mysql.exportDatabase",
        message: `Failed to export database ${database}`,
      });
      setConnectionActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setMysqlDatabaseContextMenu(null);
    }
  };

  const handleMysqlImportDatabase = async (database: string) => {
    if (!activeConnectionId) {
      return;
    }
    try {
      const message = await mysqlImportSql(activeConnectionId, database);
      await refreshMysqlDatabases();
      await loadMysqlTables(database);
      if (message) {
        window.alert(message);
      }
    } catch (error) {
      logError(error, {
        source: "app.mysql.importDatabase",
        message: `Failed to import SQL into database ${database}`,
      });
      setConnectionActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setMysqlDatabaseContextMenu(null);
    }
  };

  const handleMysqlExportTable = async (database: string, table: string, includeData: boolean) => {
    if (!activeConnectionId) {
      return;
    }
    try {
      const message = await mysqlExportTable(activeConnectionId, database, table, includeData);
      if (message) {
        window.alert(message);
      }
    } catch (error) {
      logError(error, {
        source: "app.mysql.exportTable",
        message: `Failed to export table ${database}.${table}`,
      });
      setConnectionActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setMysqlTableContextMenu(null);
    }
  };

  const handleMysqlImportTable = async (database: string, table: string) => {
    if (!activeConnectionId) {
      return;
    }
    try {
      const message = await mysqlImportSql(activeConnectionId, database, table);
      await loadMysqlTables(database);
      if (message) {
        window.alert(message);
      }
    } catch (error) {
      logError(error, {
        source: "app.mysql.importTable",
        message: `Failed to import SQL into table ${database}.${table}`,
      });
      setConnectionActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setMysqlTableContextMenu(null);
    }
  };

  const handleMysqlCreateTable = async (database: string) => {
    if (!activeConnectionId) {
      return;
    }
    setMysqlDatabaseContextMenu(null);
    // Navigate to Table Manager and open the database
    setExpandedDatabase(database);
    navigate("/mysql/tables");
  };

  return {
    databases,
    tablesByDb,
    expandedDatabase,
    selectedDatabase,
    selectedTable,
    openedTables,
    activeOpenedTableKey,
    sidebarExpandedTablesDatabase,
    mysqlDatabaseContextMenu,
    mysqlTableContextMenu,
    mysqlTabContextMenu,
    closeMysqlMenus,
    refreshMysqlDatabases,
    handleMysqlSelectDatabase,
    handleMysqlOpenDatabase,
    handleMysqlCloseDatabase,
    handleMysqlToggleSidebarTables,
    handleMysqlSelectSidebarTable,
    handleMysqlOpenSidebarTable,
    handleActivateMysqlOpenedTable,
    handleCloseMysqlOpenedTable,
    handleMysqlDatabaseContextMenu,
    handleMysqlTableContextMenu,
    handleMysqlTabContextMenu,
    closeCurrentMysqlTab,
    closeOtherMysqlTabs,
    closeAllMysqlTabs,
    handleCreateMysqlDatabase,
    handleDropMysqlDatabase,
    handleMysqlExportDatabase,
    handleMysqlImportDatabase,
    handleMysqlExportTable,
    handleMysqlImportTable,
    handleMysqlCreateTable,
    setMysqlDatabaseContextMenu,
    setMysqlTableContextMenu,
    setMysqlTabContextMenu,
  };
}