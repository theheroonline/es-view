import { useCallback, useState } from "react";
import { logError } from "../../../../../lib/errorLog";
import { exportSelectedTablesSql, exportTableSql, importTableSql } from "../services/tableExportService";
import type { ExportSelectionModalState } from "../utils";

interface UseExportImportReturn {
  exportSelectionModal: ExportSelectionModalState | null;
  setExportSelectionModal: (state: ExportSelectionModalState | null | ((prev: ExportSelectionModalState | null) => ExportSelectionModalState | null)) => void;
  exportSuccessMessage: string | null;
  setExportSuccessMessage: (message: string | null) => void;
  handleExportTableSql: (database: string, table: string, includeData: boolean) => Promise<void>;
  handleExportSelectedTablesSql: (database: string, tables: string[], includeData: boolean) => Promise<boolean>;
  handleImportTableSql: (
    database: string,
    table: string,
    onImportSuccess?: (message?: string) => Promise<void>
  ) => Promise<void>;
  handleConfirmExportSelection: () => Promise<void>;
}

interface UseExportImportProps {
  connectionId: string | null | undefined;
  onError?: (error: Error | string) => void;
}

export function useExportImport({ connectionId, onError }: UseExportImportProps): UseExportImportReturn {
  const [exportSelectionModal, setExportSelectionModal] = useState<ExportSelectionModalState | null>(null);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  const handleExportTableSql = useCallback(
    async (database: string, table: string, includeData: boolean) => {
      if (!connectionId) return;
      try {
        const message = await exportTableSql(connectionId, database, table, includeData);
        if (message) {
          setExportSuccessMessage(message);
        }
      } catch (err) {
        logError(err, {
          source: "useExportImport.exportTable",
          message: `Failed to export table ${database}.${table}`
        });
        const errorMsg = err instanceof Error ? err.message : String(err);
        onError?.(errorMsg);
      }
    },
    [connectionId, onError]
  );

  const handleExportSelectedTablesSql = useCallback(
    async (database: string, tables: string[], includeData: boolean): Promise<boolean> => {
      if (!connectionId || tables.length === 0) return false;
      try {
        const message = await exportSelectedTablesSql(connectionId, database, tables, includeData);
        if (message) {
          setExportSuccessMessage(message);
        }
        return true;
      } catch (err) {
        logError(err, {
          source: "useExportImport.exportSelectedTables",
          message: `Failed to export selected tables from ${database}`
        });
        const errorMsg = err instanceof Error ? err.message : String(err);
        onError?.(errorMsg);
        return false;
      }
    },
    [connectionId, onError]
  );

  const handleImportTableSql = useCallback(
    async (
      database: string,
      table: string,
      onImportSuccess?: (message?: string) => Promise<void>
    ) => {
      if (!connectionId) return;
      try {
        const message = await importTableSql(connectionId, database, table);
        if (onImportSuccess) {
          await onImportSuccess(message);
        }
      } catch (err) {
        logError(err, {
          source: "useExportImport.importTable",
          message: `Failed to import SQL into table ${database}.${table}`
        });
        const errorMsg = err instanceof Error ? err.message : String(err);
        onError?.(errorMsg);
      }
    },
    [connectionId, onError]
  );

  const handleConfirmExportSelection = useCallback(async () => {
    if (!exportSelectionModal) return;
    const success = await handleExportSelectedTablesSql(
      exportSelectionModal.database,
      exportSelectionModal.selectedTables,
      exportSelectionModal.includeData
    );
    if (success) {
      setExportSelectionModal(null);
    }
  }, [exportSelectionModal, handleExportSelectedTablesSql]);

  return {
    exportSelectionModal,
    setExportSelectionModal,
    exportSuccessMessage,
    setExportSuccessMessage,
    handleExportTableSql,
    handleExportSelectedTablesSql,
    handleImportTableSql,
    handleConfirmExportSelection
  };
}
