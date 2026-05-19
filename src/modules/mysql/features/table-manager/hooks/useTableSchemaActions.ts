import { useCallback, useState } from "react";
import { logError } from "../../../../../lib/errorLog";
import type { MysqlOpenedTable } from "../../../types";
import { getMysqlOpenedTableKey, getMysqlOpenedTableTabKey } from "../../../types";
import { executeTableSchemaQuery } from "../services/tableSchemaService";
import { defaultDataState, type DataState, type RightPanelTab, type TableInfo } from "../utils";

interface ConfirmDialogState {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  isDangerous?: boolean;
}

interface CopyTableDialogState {
  open: boolean;
  db: string;
  table: string;
  nextName: string;
}

interface UseTableSchemaActionsProps {
  connectionId: string | null | undefined;
  selectedTableInfo: TableInfo | null;
  rightPanelTab: RightPanelTab;
  activeOpenedTableKey: string | null;
  openedTables: MysqlOpenedTable[];
  locationPathname: string;
  navigate: (path: string) => void | Promise<void>;
  refreshTablesForDb: (db: string) => Promise<void>;
  handleOpenTable: (db: string, table: string, tab: RightPanelTab) => Promise<void>;
  setTablesByDb: (state: Record<string, string[]> | ((prev: Record<string, string[]>) => Record<string, string[]>)) => void;
  setSelectedTable: (table: string | undefined) => void;
  setSelectedTableInfo: (info: TableInfo | null) => void;
  setDataState: (state: DataState | ((prev: DataState) => DataState)) => void;
  setOpenedTables: (state: MysqlOpenedTable[] | ((prev: MysqlOpenedTable[]) => MysqlOpenedTable[])) => void;
  setActiveOpenedTableKey: (key: string | null) => void;
  setConfirmDialog: (state: ConfirmDialogState) => void;
  setError: (error: string) => void;
  t: (key: string, options?: any) => string;
}

export function useTableSchemaActions({
  connectionId,
  selectedTableInfo,
  rightPanelTab,
  activeOpenedTableKey,
  openedTables,
  locationPathname,
  navigate,
  refreshTablesForDb,
  handleOpenTable,
  setTablesByDb,
  setSelectedTable,
  setSelectedTableInfo,
  setDataState,
  setOpenedTables,
  setActiveOpenedTableKey,
  setConfirmDialog,
  setError,
  t,
}: UseTableSchemaActionsProps) {
  const [copyTableDialog, setCopyTableDialog] = useState<CopyTableDialogState>({
    open: false,
    db: "",
    table: "",
    nextName: ""
  });

  const handleDropTable = useCallback(async (db: string, table: string) => {
    if (!connectionId) return;

    const onConfirm = async () => {
      try {
        await executeTableSchemaQuery(connectionId, `DROP TABLE \`${db}\`.\`${table}\``);
        setTablesByDb((prev) => ({
          ...prev,
          [db]: (prev[db] ?? []).filter((item) => item !== table)
        }));
        if (selectedTableInfo?.database === db && selectedTableInfo?.table === table) {
          setSelectedTable(undefined);
          setSelectedTableInfo(null);
          setDataState(defaultDataState);
        }
        const targetKey = getMysqlOpenedTableKey(db, table);
        const remainingOpenedTables = openedTables.filter((item) => getMysqlOpenedTableKey(item.database, item.table) !== targetKey);
        setOpenedTables(remainingOpenedTables);
        if (activeOpenedTableKey && activeOpenedTableKey.startsWith(`${db}::${table}::`)) {
          const nextActive = remainingOpenedTables[remainingOpenedTables.length - 1] ?? null;
          setActiveOpenedTableKey(nextActive ? getMysqlOpenedTableTabKey(nextActive.database, nextActive.table, nextActive.view) : null);
          if (locationPathname === "/mysql/table") {
            await navigate(nextActive ? "/mysql/table" : "/mysql/tables");
          }
        }
      } catch (err) {
        logError(err, {
          source: "mysqlTableManager.dropTable",
          message: `Failed to drop table ${db}.${table}`
        });
        setError(err instanceof Error ? err.message : String(err));
      }
    };

    setConfirmDialog({
      open: true,
      title: t("mysql.tableManager.dropTable"),
      message: t("mysql.tableManager.dropTableConfirm", { table: `\`${db}\`.\`${table}\`` }),
      isDangerous: true,
      onConfirm
    });
  }, [activeOpenedTableKey, connectionId, locationPathname, navigate, openedTables, selectedTableInfo, setActiveOpenedTableKey, setConfirmDialog, setDataState, setError, setOpenedTables, setSelectedTable, setSelectedTableInfo, setTablesByDb, t]);

  const handleTruncateTable = useCallback(async (db: string, table: string) => {
    if (!connectionId) return;

    const onConfirm = async () => {
      try {
        await executeTableSchemaQuery(connectionId, `TRUNCATE TABLE \`${db}\`.\`${table}\``);
        if (selectedTableInfo?.database === db && selectedTableInfo?.table === table) {
          await handleOpenTable(db, table, rightPanelTab);
        }
      } catch (err) {
        logError(err, {
          source: "mysqlTableManager.truncateTable",
          message: `Failed to truncate table ${db}.${table}`
        });
        setError(err instanceof Error ? err.message : String(err));
      }
    };

    setConfirmDialog({
      open: true,
      title: t("mysql.tableManager.truncate"),
      message: t("mysql.tableManager.truncateConfirm", { table: `\`${db}\`.\`${table}\`` }),
      isDangerous: true,
      onConfirm
    });
  }, [connectionId, handleOpenTable, rightPanelTab, selectedTableInfo, setConfirmDialog, setError, t]);

  const handleCopyTable = useCallback(async (db: string, table: string) => {
    if (!connectionId) return;

    setCopyTableDialog({
      open: true,
      db,
      table,
      nextName: `${table}_copy`
    });
  }, [connectionId]);

  const handleConfirmCopyTable = useCallback(async () => {
    if (!connectionId || !copyTableDialog.open) return;

    const { db, table } = copyTableDialog;
    const nextName = copyTableDialog.nextName.trim();
    if (!nextName || nextName === table) {
      setCopyTableDialog((prev) => ({ ...prev, open: false }));
      return;
    }

    try {
      await executeTableSchemaQuery(connectionId, `CREATE TABLE \`${db}\`.\`${nextName}\` LIKE \`${db}\`.\`${table}\``);
      await executeTableSchemaQuery(connectionId, `INSERT INTO \`${db}\`.\`${nextName}\` SELECT * FROM \`${db}\`.\`${table}\``);
      await refreshTablesForDb(db);
      setCopyTableDialog((prev) => ({ ...prev, open: false }));
    } catch (err) {
      logError(err, {
        source: "mysqlTableManager.copyTable",
        message: `Failed to copy table ${db}.${table} to ${nextName}`
      });
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [connectionId, copyTableDialog, refreshTablesForDb, setError]);

  return {
    copyTableDialog,
    setCopyTableDialog,
    handleDropTable,
    handleTruncateTable,
    handleCopyTable,
    handleConfirmCopyTable,
  };
}
