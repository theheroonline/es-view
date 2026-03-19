import { useEffect, useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { logError } from "../../../lib/errorLog";
import type { ConnectionProfile } from "../../../lib/types";
import { getMysqlOpenedTableKey, useMysqlContext } from "../../../state/MysqlContext";
import { getCharsetOption, MYSQL_CHARSET_OPTIONS } from "../constants/databaseOptions";
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

interface CreateDatabaseDialogState {
  connectionId: string;
  name: string;
  charset: string;
  collation: string;
}

interface DatabasePropertiesDialogState {
  database: string;
  charset: string;
  collation: string;
}

interface TableTransferDialogState {
  sourceDatabase: string;
  sourceTables: string[];
  targetDatabase: string;
}

interface TableTransferTaskItem {
  table: string;
  status: "pending" | "running" | "success" | "error";
  error?: string;
}

interface TableTransferTaskState {
  sourceDatabase: string;
  sourceTables: string[];
  targetDatabase: string;
  includeData: boolean;
  status: "running" | "completed";
  items: TableTransferTaskItem[];
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

  const [expandedSidebarDatabases, setExpandedSidebarDatabases] = useState<string[]>([]);
  const [sidebarExpandedTablesDatabases, setSidebarExpandedTablesDatabases] = useState<string[]>([]);
  const [selectedSidebarTables, setSelectedSidebarTables] = useState<string[]>([]);
  const [sidebarSelectionAnchor, setSidebarSelectionAnchor] = useState<string | null>(null);
  const [mysqlDatabaseContextMenu, setMysqlDatabaseContextMenu] = useState<DatabaseMenuState | null>(null);
  const [mysqlTableContextMenu, setMysqlTableContextMenu] = useState<TableMenuState | null>(null);
  const [mysqlTabContextMenu, setMysqlTabContextMenu] = useState<TabMenuState | null>(null);
  const [createDatabaseDialog, setCreateDatabaseDialog] = useState<CreateDatabaseDialogState | null>(null);
  const [databasePropertiesDialog, setDatabasePropertiesDialog] = useState<DatabasePropertiesDialogState | null>(null);
  const [tableTransferDialog, setTableTransferDialog] = useState<TableTransferDialogState | null>(null);
  const [tableTransferTask, setTableTransferTask] = useState<TableTransferTaskState | null>(null);

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

    setExpandedSidebarDatabases([]);
    setSidebarExpandedTablesDatabases([]);
    setSelectedSidebarTables([]);
    setSidebarSelectionAnchor(null);
    closeMysqlMenus();
  }, [activeConnectionId, getProfileById]);

  const getOrderedSidebarTables = (database: string, tables: string[]) => {
    const availableTables = tablesByDb[database] ?? [];
    const selectedSet = new Set(tables);
    return availableTables.filter((table) => selectedSet.has(table));
  };

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
    setSelectedSidebarTables([]);
    setSidebarSelectionAnchor(null);
  };

  const handleMysqlOpenDatabase = async (database: string) => {
    setExpandedDatabase(database);
    setExpandedSidebarDatabases((prev) => (prev.includes(database) ? prev : [...prev, database]));
    setSelectedDatabase(database);
    setSelectedTable(undefined);
    setSelectedSidebarTables([]);
    setSidebarSelectionAnchor(null);
    if (!tablesByDb[database]) {
      await loadMysqlTables(database);
    }
    await navigate("/mysql/tables");
  };

  const handleMysqlCloseDatabase = async (database: string) => {
    if (expandedDatabase === database) {
      setExpandedDatabase(null);
    }
    setSelectedTable(undefined);
    if (selectedDatabase === database) {
      setSelectedSidebarTables([]);
      setSidebarSelectionAnchor(null);
    }
    setExpandedSidebarDatabases((prev) => prev.filter((item) => item !== database));
    setSidebarExpandedTablesDatabases((prev) => prev.filter((item) => item !== database));

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

    if (!expandedSidebarDatabases.includes(database)) {
      await handleMysqlOpenDatabase(database);
    } else if (!tablesByDb[database]) {
      await loadMysqlTables(database);
    }

    setSidebarExpandedTablesDatabases((prev) =>
      prev.includes(database) ? prev.filter((item) => item !== database) : [...prev, database]
    );
  };

  const handleMysqlSelectSidebarTable = async (event: MouseEvent<HTMLDivElement>, database: string, table: string) => {
    setSelectedDatabase(database);
    setSelectedTable(table);

    const availableTables = tablesByDb[database] ?? [];
    const canSelectRange = event.shiftKey && sidebarSelectionAnchor && availableTables.includes(sidebarSelectionAnchor);
    const isToggleSelection = event.ctrlKey || event.metaKey;

    setSelectedSidebarTables((prev) => {
      if (canSelectRange && sidebarSelectionAnchor) {
        const startIndex = availableTables.indexOf(sidebarSelectionAnchor);
        const endIndex = availableTables.indexOf(table);
        return availableTables.slice(Math.min(startIndex, endIndex), Math.max(startIndex, endIndex) + 1);
      }

      if (isToggleSelection) {
        return prev.includes(table)
          ? prev.filter((item) => item !== table)
          : getOrderedSidebarTables(database, [...prev, table]);
      }

      return [table];
    });
    setSidebarSelectionAnchor(table);

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

    const charset = MYSQL_CHARSET_OPTIONS[0]?.value ?? "utf8mb4";
    setCreateDatabaseDialog({
      connectionId,
      name: "new_database",
      charset,
      collation: getCharsetOption(charset).defaultCollation,
    });
  };

  const handleConfirmCreateMysqlDatabase = async () => {
    if (!createDatabaseDialog) {
      return;
    }

    const nextName = createDatabaseDialog.name.trim();
    if (!nextName) {
      return;
    }

    try {
      await mysqlQuery(
        createDatabaseDialog.connectionId,
        `CREATE DATABASE \`${nextName}\` CHARACTER SET ${createDatabaseDialog.charset} COLLATE ${createDatabaseDialog.collation}`
      );
      await refreshMysqlDatabases();
      setSelectedDatabase(nextName);
      setExpandedSidebarDatabases((prev) => (prev.includes(nextName) ? prev : [...prev, nextName]));
      setCreateDatabaseDialog(null);
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

      setExpandedSidebarDatabases((prev) => prev.filter((item) => item !== database));
      setSidebarExpandedTablesDatabases((prev) => prev.filter((item) => item !== database));
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

  const handleViewDatabaseProperties = async (database: string) => {
    if (!activeConnectionId) {
      return;
    }

    try {
      // Query database info to get charset and collation
      const result = await mysqlQuery(
        activeConnectionId,
        `SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = '${database}'`
      );

      let charset = MYSQL_CHARSET_OPTIONS[0]?.value ?? "utf8mb4";
      let collation = getCharsetOption(charset).defaultCollation;

      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0];
        if (Array.isArray(row) && row.length >= 2) {
          // DEFAULT_CHARACTER_SET_NAME is first column
          if (row[0]) {
            charset = String(row[0]);
          }
          // DEFAULT_COLLATION_NAME is second column
          if (row[1]) {
            collation = String(row[1]);
          }
        }
      }

      setDatabasePropertiesDialog({
        database,
        charset,
        collation,
      });
    } catch (error) {
      logError(error, {
        source: "app.mysql.viewDatabaseProperties",
        message: `Failed to load database properties for ${database}`,
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

  const handleSidebarTableDragStart = (event: React.DragEvent<HTMLDivElement>, database: string, table: string) => {
    const draggedTables = selectedDatabase === database && selectedSidebarTables.includes(table)
      ? getOrderedSidebarTables(database, selectedSidebarTables)
      : [table];

    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-mysql-table", JSON.stringify({ database, tables: draggedTables }));
  };

  const handleSidebarDatabaseDrop = (event: React.DragEvent<HTMLDivElement>, targetDatabase: string) => {
    event.preventDefault();
    const payload = event.dataTransfer.getData("application/x-mysql-table");
    if (!payload) {
      return;
    }

    try {
      const { database, tables } = JSON.parse(payload) as { database?: string; tables?: string[] };
      const sourceTables = (tables ?? []).filter(Boolean);
      if (!database || sourceTables.length === 0 || database === targetDatabase) {
        return;
      }

      setTableTransferDialog({
        sourceDatabase: database,
        sourceTables,
        targetDatabase,
      });
    } catch {
      return;
    }
  };

  const handleConfirmTableTransfer = async (includeData: boolean) => {
    if (!activeConnectionId || !tableTransferDialog) {
      return;
    }

    const { sourceDatabase, sourceTables, targetDatabase } = tableTransferDialog;
    let nextItems: TableTransferTaskItem[] = sourceTables.map((table) => ({
      table,
      status: "pending",
    }));

    setTableTransferTask({
      sourceDatabase,
      sourceTables,
      targetDatabase,
      includeData,
      status: "running",
      items: nextItems,
    });
    setTableTransferDialog(null);

    for (const sourceTable of sourceTables) {
      nextItems = nextItems.map((item) => (
        item.table === sourceTable ? { ...item, status: "running", error: undefined } : item
      ));
      setTableTransferTask((prev) => prev ? { ...prev, items: nextItems } : prev);

      try {
        await mysqlQuery(
          activeConnectionId,
          `CREATE TABLE \`${targetDatabase}\`.\`${sourceTable}\` LIKE \`${sourceDatabase}\`.\`${sourceTable}\``
        );

        if (includeData) {
          await mysqlQuery(
            activeConnectionId,
            `INSERT INTO \`${targetDatabase}\`.\`${sourceTable}\` SELECT * FROM \`${sourceDatabase}\`.\`${sourceTable}\``
          );
        }
        nextItems = nextItems.map((item) => (
          item.table === sourceTable ? { ...item, status: "success" } : item
        ));
      } catch (error) {
        logError(error, {
          source: "app.mysql.copyTableBetweenDatabases",
          message: `Failed to copy ${sourceDatabase}.${sourceTable} to ${targetDatabase}`,
        });
        nextItems = nextItems.map((item) => (
          item.table === sourceTable
            ? { ...item, status: "error", error: error instanceof Error ? error.message : String(error) }
            : item
        ));
      }
      setTableTransferTask((prev) => prev ? { ...prev, items: nextItems } : prev);
    }

    try {
      await loadMysqlTables(targetDatabase);
    } catch (error) {
      logError(error, {
        source: "app.mysql.refreshCopiedTables",
        message: `Failed to refresh copied tables for ${targetDatabase}`,
      });
      setConnectionActionError(error instanceof Error ? error.message : String(error));
    }

    setTableTransferTask((prev) => prev ? { ...prev, status: "completed", items: nextItems } : prev);
  };

  return {
    databases,
    tablesByDb,
    expandedDatabase,
    expandedSidebarDatabases,
    selectedSidebarTables,
    selectedDatabase,
    selectedTable,
    openedTables,
    activeOpenedTableKey,
    sidebarExpandedTablesDatabases,
    mysqlDatabaseContextMenu,
    mysqlTableContextMenu,
    mysqlTabContextMenu,
    createDatabaseDialog,
    databasePropertiesDialog,
    tableTransferDialog,
    tableTransferTask,
    closeMysqlMenus,
    refreshMysqlDatabases,
    handleMysqlSelectDatabase,
    handleMysqlOpenDatabase,
    handleMysqlCloseDatabase,
    handleMysqlToggleSidebarTables,
    setSelectedSidebarTables,
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
    handleConfirmCreateMysqlDatabase,
    handleDropMysqlDatabase,
    handleMysqlExportDatabase,
    handleMysqlImportDatabase,
    handleViewDatabaseProperties,
    handleMysqlExportTable,
    handleMysqlImportTable,
    handleMysqlCreateTable,
    handleSidebarTableDragStart,
    handleSidebarDatabaseDrop,
    handleConfirmTableTransfer,
    setCreateDatabaseDialog,
    setDatabasePropertiesDialog,
    setTableTransferDialog,
    setTableTransferTask,
    setMysqlDatabaseContextMenu,
    setMysqlTableContextMenu,
    setMysqlTabContextMenu,
  };
}