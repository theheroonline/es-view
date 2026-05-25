import { useCallback } from "react";
import { logError } from "../../../../../lib/errorLog";
import type { IndexMeta } from "../../../types";
import { createTableIndex, dropTableIndex, listTableIndexes } from "../services/tableSchemaService";
import type { TableInfo } from "../utils";

interface UseTableIndexManagementActionsProps {
  connectionId: string | null | undefined;
  selectedTableInfo: TableInfo | null;
  indexes: IndexMeta[];
  indexFormData: {
    name: string;
    columns: string[];
    unique: boolean;
    indexType: string;
  };
  setIndexes: (indexes: IndexMeta[]) => void;
  setIndexLoading: (loading: boolean) => void;
  setIndexError: (error: string) => void;
  setIndexModalOpen: (open: boolean) => void;
  setIndexModalMode: (mode: "view" | "create" | "edit") => void;
  setIndexFormData: (updater: { name: string; columns: string[]; unique: boolean; indexType: string } | ((prev: { name: string; columns: string[]; unique: boolean; indexType: string }) => { name: string; columns: string[]; unique: boolean; indexType: string })) => void;
  setConfirmDialog: (dialog: {
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDangerous?: boolean;
  }) => void;
  t: (key: string, options?: any) => string;
}

const emptyIndexForm = { name: "", columns: [] as string[], unique: false, indexType: "BTREE" };

export function useTableIndexManagementActions({
  connectionId,
  selectedTableInfo,
  indexes,
  indexFormData,
  setIndexes,
  setIndexLoading,
  setIndexError,
  setIndexModalOpen,
  setIndexModalMode,
  setIndexFormData,
  setConfirmDialog,
  t,
}: UseTableIndexManagementActionsProps) {
  const loadIndexes = useCallback(async (db: string, table: string) => {
    if (!connectionId) return;
    try {
      setIndexLoading(true);
      setIndexError("");
      const data = await listTableIndexes(connectionId, db, table);
      setIndexes(data);
    } catch (err) {
      logError(err, {
        source: "useTableIndexManagementActions.loadIndexes",
        message: `Failed to load indexes for ${db}.${table}`
      });
      setIndexError(err instanceof Error ? err.message : String(err));
    } finally {
      setIndexLoading(false);
    }
  }, [connectionId, setIndexError, setIndexLoading, setIndexes]);

  const openIndexModal = useCallback(async () => {
    if (!selectedTableInfo) return;
    setIndexModalMode("view");
    setIndexFormData(emptyIndexForm);
    setIndexModalOpen(true);
    await loadIndexes(selectedTableInfo.database, selectedTableInfo.table);
  }, [loadIndexes, selectedTableInfo, setIndexFormData, setIndexModalMode, setIndexModalOpen]);

  const openCreateIndexModal = useCallback(() => {
    if (!selectedTableInfo) return;
    setIndexModalMode("create");
    setIndexFormData(emptyIndexForm);
    setIndexModalOpen(true);
  }, [selectedTableInfo, setIndexFormData, setIndexModalMode, setIndexModalOpen]);

  const openEditIndexModal = useCallback((index: IndexMeta) => {
    if (!selectedTableInfo) return;
    setIndexModalMode("edit");
    setIndexFormData({
      name: index.name,
      columns: [...index.columns],
      unique: index.unique,
      indexType: index.indexType
    });
    setIndexModalOpen(true);
  }, [selectedTableInfo, setIndexFormData, setIndexModalMode, setIndexModalOpen]);

  const handleCreateIndex = useCallback(async () => {
    if (!selectedTableInfo || !connectionId || indexFormData.columns.length === 0) return;
    try {
      setIndexLoading(true);
      setIndexError("");
      await createTableIndex(
        connectionId,
        selectedTableInfo.database,
        selectedTableInfo.table,
        indexFormData.name,
        indexFormData.columns,
        indexFormData.unique,
        indexFormData.indexType
      );
      await loadIndexes(selectedTableInfo.database, selectedTableInfo.table);
      setIndexFormData(emptyIndexForm);
      setIndexModalMode("view");
    } catch (err) {
      logError(err, {
        source: "useTableIndexManagementActions.createIndex",
        message: "Failed to create index"
      });
      setIndexError(err instanceof Error ? err.message : String(err));
    } finally {
      setIndexLoading(false);
    }
  }, [connectionId, indexFormData.columns, indexFormData.indexType, indexFormData.name, indexFormData.unique, loadIndexes, selectedTableInfo, setIndexError, setIndexFormData, setIndexLoading, setIndexModalMode]);

  const handleUpdateIndex = useCallback(async () => {
    if (!selectedTableInfo || !connectionId || indexFormData.columns.length === 0) return;
    const oldIndex = indexes.find((idx) => idx.name === indexFormData.name);
    if (!oldIndex) return;

    try {
      setIndexLoading(true);
      setIndexError("");
      await dropTableIndex(connectionId, selectedTableInfo.database, selectedTableInfo.table, oldIndex.name);
      await createTableIndex(
        connectionId,
        selectedTableInfo.database,
        selectedTableInfo.table,
        indexFormData.name,
        indexFormData.columns,
        indexFormData.unique,
        indexFormData.indexType
      );
      await loadIndexes(selectedTableInfo.database, selectedTableInfo.table);
      setIndexFormData(emptyIndexForm);
      setIndexModalMode("view");
    } catch (err) {
      logError(err, {
        source: "useTableIndexManagementActions.updateIndex",
        message: "Failed to update index"
      });
      setIndexError(err instanceof Error ? err.message : String(err));
    } finally {
      setIndexLoading(false);
    }
  }, [connectionId, indexFormData.columns, indexFormData.indexType, indexFormData.name, indexFormData.unique, indexes, loadIndexes, selectedTableInfo, setIndexError, setIndexFormData, setIndexLoading, setIndexModalMode]);

  const handleDropIndex = useCallback((indexName: string) => {
    if (!selectedTableInfo || !connectionId) return;

    const onConfirm = async () => {
      try {
        setIndexLoading(true);
        setIndexError("");
        await dropTableIndex(connectionId, selectedTableInfo.database, selectedTableInfo.table, indexName);
        await loadIndexes(selectedTableInfo.database, selectedTableInfo.table);
      } catch (err) {
        logError(err, {
          source: "useTableIndexManagementActions.dropIndex",
          message: "Failed to drop index"
        });
        setIndexError(err instanceof Error ? err.message : String(err));
      } finally {
        setIndexLoading(false);
      }
    };

    setConfirmDialog({
      open: true,
      title: t("mysql.tableManager.dropIndex"),
      message: t("mysql.tableManager.dropIndexConfirm", { index: `\"${indexName}\"` }),
      isDangerous: true,
      onConfirm
    });
  }, [connectionId, loadIndexes, selectedTableInfo, setConfirmDialog, setIndexError, setIndexLoading, t]);

  const handleBackToIndexView = useCallback(() => {
    setIndexModalMode("view");
    setIndexFormData(emptyIndexForm);
  }, [setIndexFormData, setIndexModalMode]);

  const handleIndexNameChange = useCallback((name: string) => {
    setIndexFormData((prev) => ({ ...prev, name }));
  }, [setIndexFormData]);

  const handleIndexToggleColumn = useCallback((column: string, checked: boolean) => {
    setIndexFormData((prev) => ({
      ...prev,
      columns: checked
        ? [...prev.columns, column]
        : prev.columns.filter((item) => item !== column)
    }));
  }, [setIndexFormData]);

  const handleIndexUniqueChange = useCallback((unique: boolean) => {
    setIndexFormData((prev) => ({ ...prev, unique }));
  }, [setIndexFormData]);

  const handleIndexTypeChange = useCallback((indexType: string) => {
    setIndexFormData((prev) => ({ ...prev, indexType }));
  }, [setIndexFormData]);

  return {
    openIndexModal,
    openCreateIndexModal,
    openEditIndexModal,
    handleCreateIndex,
    handleUpdateIndex,
    handleDropIndex,
    handleBackToIndexView,
    handleIndexNameChange,
    handleIndexToggleColumn,
    handleIndexUniqueChange,
    handleIndexTypeChange,
  };
}
