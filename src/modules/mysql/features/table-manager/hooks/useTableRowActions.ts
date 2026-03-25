import { useCallback } from "react";
import { logError } from "../../../../../lib/errorLog";
import type { MysqlOpenedTable } from "../../../types";
import type { ColumnMeta } from "../../../types";
import { executeTableDataQuery } from "../services/tableDataService";
import type { DataState, SelectedCell, TableInfo } from "../utils";

interface ConfirmDialogState {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  isDangerous?: boolean;
}

interface UseTableRowActionsProps {
  connectionId: string | null | undefined;
  selectedTableInfo: TableInfo | null;
  dataState: DataState;
  dataColumnMeta: ColumnMeta[];
  selectedCells: SelectedCell[];
  batchEditMode: "text" | "null" | "empty";
  batchEditValue: string;
  activeOpenedTable: MysqlOpenedTable | null;
  t: (key: string, options?: any) => string;
  fetchData: (db?: string, table?: string, page?: number, pageSize?: number) => Promise<void>;
  setConfirmDialog: (state: ConfirmDialogState) => void;
  setDataState: (state: DataState | ((prev: DataState) => DataState)) => void;
  setBatchEditModalOpen: (open: boolean) => void;
  setBatchEditMode: (mode: "text" | "null" | "empty") => void;
  setBatchEditValue: (value: string) => void;
  setBatchEditError: (error: string) => void;
  setSelectedCells: (cells: SelectedCell[]) => void;
  setSelectionAnchor: (anchor: { rowIndex: number; columnIndex: number } | null) => void;
  setAddRowModalOpen: (open: boolean) => void;
  setAddRowFormData: (data: Record<string, string>) => void;
  setAddRowError: (error: string) => void;
}

export function useTableRowActions({
  connectionId,
  selectedTableInfo,
  dataState,
  dataColumnMeta,
  selectedCells,
  batchEditMode,
  batchEditValue,
  activeOpenedTable,
  t,
  fetchData,
  setConfirmDialog,
  setDataState,
  setBatchEditModalOpen,
  setBatchEditMode,
  setBatchEditValue,
  setBatchEditError,
  setSelectedCells,
  setSelectionAnchor,
  setAddRowModalOpen,
  setAddRowFormData,
  setAddRowError,
}: UseTableRowActionsProps) {
  const updateRowByIndex = useCallback(async (rowIndex: number, updates: Record<string, unknown>, options?: { refresh?: boolean }) => {
    if (!connectionId || !selectedTableInfo) return;
    const { database: db, table } = selectedTableInfo;
    const originalRow = dataState.rows[rowIndex];
    if (!originalRow) return;

    const setParts: string[] = [];
    for (const [col, val] of Object.entries(updates)) {
      if (val === null) {
        setParts.push(`\`${col}\` = NULL`);
      } else if (typeof val === "number") {
        setParts.push(`\`${col}\` = ${val}`);
      } else if (typeof val === "boolean") {
        setParts.push(`\`${col}\` = ${val ? 1 : 0}`);
      } else {
        // 对于字符串，直接使用用户输入的值（前端已经格式化好了）
        const strVal = String(val).replace(/'/g, "''");
        setParts.push(`\`${col}\` = '${strVal}'`);
      }
    }

    const whereParts: string[] = [];
    const pkCol = dataColumnMeta.find((column) => column.key === "PRI");
    if (pkCol) {
      const colIndex = dataState.columns.indexOf(pkCol.field);
      if (colIndex >= 0) {
        const value = originalRow[colIndex];
        if (value === null) {
          whereParts.push(`\`${pkCol.field}\` IS NULL`);
        } else {
          whereParts.push(`\`${pkCol.field}\` = '${String(value).replace(/'/g, "''")}'`);
        }
      }
    } else {
      dataState.columns.forEach((column, index) => {
        const value = originalRow[index];
        if (value === null) {
          whereParts.push(`\`${column}\` IS NULL`);
        } else {
          whereParts.push(`\`${column}\` = '${String(value).replace(/'/g, "''")}'`);
        }
      });
    }

    if (setParts.length === 0 || whereParts.length === 0) return;
    const sql = `UPDATE \`${db}\`.\`${table}\` SET ${setParts.join(", ")} WHERE ${whereParts.join(" AND ")} LIMIT 1`;
    await executeTableDataQuery(connectionId, sql);

    if (options?.refresh === false) {
      const updatedRow = [...originalRow];
      Object.entries(updates).forEach(([column, value]) => {
        const colIndex = dataState.columns.indexOf(column);
        if (colIndex >= 0) {
          updatedRow[colIndex] = value;
        }
      });
      setDataState((prev) => ({
        ...prev,
        rows: prev.rows.map((row, index) => (index === rowIndex ? updatedRow : row))
      }));
    } else {
      await fetchData();
    }
  }, [connectionId, dataColumnMeta, dataState.columns, dataState.rows, fetchData, selectedTableInfo, setDataState]);

  const handleSaveCell = useCallback(async (
    rowIndex: number,
    columnIndex: number,
    columnName: string,
    newValue: string
  ) => {
    if (!connectionId || !selectedTableInfo) return;

    try {
      const row = dataState.rows[rowIndex];
      const oldValue = row[columnIndex];

      // 比较原值和新值，处理空字符串和 null 的情况
      const normalizedOldValue = oldValue === null ? "" : String(oldValue);
      const normalizedNewValue = newValue === "" ? null : newValue;

      if (normalizedOldValue === (newValue === "" ? "" : newValue)) {
        return;
      }

      // 只更新修改的那一列
      const updateData: Record<string, unknown> = {
        [columnName]: normalizedNewValue
      };

      await updateRowByIndex(rowIndex, updateData, { refresh: false });
    } catch (err) {
      logError(err, {
        source: "mysqlTableManager.saveCell",
        message: `Failed to update cell ${columnName} in ${selectedTableInfo.database}.${selectedTableInfo.table}`
      });
      throw err;
    }
  }, [connectionId, dataState.rows, selectedTableInfo, updateRowByIndex]);

  const handleDeleteRow = useCallback(async (index: number) => {
    if (!connectionId || !selectedTableInfo) return;
    const { database: db, table } = selectedTableInfo;

    const row = dataState.rows[index];
    const whereParts: string[] = [];
    const pkCol = dataColumnMeta.find((column) => column.key === "PRI");

    if (pkCol) {
      const colIndex = dataState.columns.indexOf(pkCol.field);
      if (colIndex >= 0) {
        const value = row[colIndex];
        if (value === null) {
          whereParts.push(`\`${pkCol.field}\` IS NULL`);
        } else {
          whereParts.push(`\`${pkCol.field}\` = '${String(value).replace(/'/g, "''")}'`);
        }
      }
    } else {
      dataState.columns.forEach((column, rowIndex) => {
        const value = row[rowIndex];
        if (value === null) {
          whereParts.push(`\`${column}\` IS NULL`);
        } else {
          whereParts.push(`\`${column}\` = '${String(value).replace(/'/g, "''")}'`);
        }
      });
    }

    if (whereParts.length === 0) return;

    const onConfirm = async () => {
      try {
        const sql = `DELETE FROM \`${db}\`.\`${table}\` WHERE ${whereParts.join(" AND ")} LIMIT 1`;
        await executeTableDataQuery(connectionId, sql);
        await fetchData();
      } catch (err) {
        logError(err, {
          source: "mysqlTableManager.deleteRow",
          message: `Failed to delete row from ${db}.${table}`
        });
        setDataState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : String(err)
        }));
      }
    };

    setConfirmDialog({
      open: true,
      title: t("common.delete"),
      message: t("dataBrowser.deleteConfirm", { docId: String(row[0] ?? index) }),
      isDangerous: true,
      onConfirm
    });
  }, [connectionId, dataColumnMeta, dataState.columns, dataState.rows, fetchData, selectedTableInfo, setConfirmDialog, setDataState, t]);

  const handleContextMenuBatchEdit = useCallback(() => {
    if (selectedCells.length === 0) return;
    setBatchEditMode("text");
    setBatchEditValue("");
    setBatchEditError("");
    setBatchEditModalOpen(true);
  }, [selectedCells.length, setBatchEditError, setBatchEditModalOpen, setBatchEditMode, setBatchEditValue]);

  const handleBatchEditSave = useCallback(async () => {
    if (!connectionId || !selectedTableInfo || selectedCells.length === 0) return;
    setBatchEditError("");

    try {
      const updates: Record<number, Record<string, unknown>> = {};
      selectedCells.forEach((cell) => {
        if (!updates[cell.rowIndex]) {
          updates[cell.rowIndex] = {};
        }
        const columnName = dataState.columns[cell.columnIndex];

        const value = batchEditMode === "null"
          ? null
          : batchEditMode === "empty"
            ? ""
            : batchEditValue;
        updates[cell.rowIndex][columnName] = value;
      });

      for (const [rowIndex, updateMap] of Object.entries(updates)) {
        await updateRowByIndex(Number(rowIndex), updateMap);
      }

      setBatchEditModalOpen(false);
      setSelectedCells([]);
      setSelectionAnchor(null);

      if (activeOpenedTable) {
        await fetchData(
          activeOpenedTable.database,
          activeOpenedTable.table,
          dataState.page,
          dataState.pageSize
        );
      }
    } catch (err) {
      logError(err, {
        source: "batchEditSave",
        message: "Failed to save batch edits"
      });
      setBatchEditError(err instanceof Error ? err.message : String(err));
    }
  }, [activeOpenedTable, batchEditMode, batchEditValue, connectionId, dataState.columns, dataState.page, dataState.pageSize, fetchData, selectedCells, selectedTableInfo, setBatchEditError, setBatchEditModalOpen, setSelectedCells, setSelectionAnchor, updateRowByIndex]);

  const handleAddNewRow = useCallback(() => {
    if (!selectedTableInfo) return;
    const formData: Record<string, string> = {};
    selectedTableInfo.columns?.forEach((column) => {
      formData[column.field] = column.default !== null && column.default !== undefined && column.default !== ""
        ? String(column.default)
        : "";
    });
    setAddRowFormData(formData);
    setAddRowError("");
    setAddRowModalOpen(true);
  }, [selectedTableInfo, setAddRowError, setAddRowFormData, setAddRowModalOpen]);

  const handleSaveNewRowWithForm = useCallback(async (addRowFormData: Record<string, string>) => {
    if (!connectionId || !selectedTableInfo) return;
    const { database: db, table } = selectedTableInfo;

    try {
      const insertColumns: string[] = [];
      const insertValues: string[] = [];

      for (const [column, value] of Object.entries(addRowFormData)) {
        if (value === "" || value === null) {
          continue;
        }

        insertColumns.push(`\`${column}\``);
        if (!isNaN(Number(value)) && value !== "") {
          insertValues.push(String(value));
        } else if (value.toLowerCase() === "true" || value === "1") {
          insertValues.push("1");
        } else if (value.toLowerCase() === "false" || value === "0") {
          insertValues.push("0");
        } else {
          insertValues.push(`'${String(value).replace(/'/g, "''")}'`);
        }
      }

      if (insertColumns.length === 0) {
        insertColumns.push(`\`${dataState.columns[0] ?? "id"}\``);
        insertValues.push("DEFAULT");
      }

      const sql = `INSERT INTO \`${db}\`.\`${table}\` (${insertColumns.join(", ")}) VALUES (${insertValues.join(", ")})`;
      await executeTableDataQuery(connectionId, sql);
      setAddRowModalOpen(false);
      setAddRowFormData({});
      setAddRowError("");
      await fetchData();
    } catch (err) {
      logError(err, {
        source: "mysqlTableManager.addNewRow",
        message: `Failed to insert row into ${selectedTableInfo.database}.${selectedTableInfo.table}`
      });
      setAddRowError(err instanceof Error ? err.message : String(err));
    }
  }, [connectionId, dataState.columns, fetchData, selectedTableInfo, setAddRowError, setAddRowFormData, setAddRowModalOpen]);

  const handleCancelNewRow = useCallback(() => {
    setAddRowModalOpen(false);
    setAddRowFormData({});
    setAddRowError("");
  }, [setAddRowError, setAddRowFormData, setAddRowModalOpen]);

  return {
    updateRowByIndex,
    handleSaveCell,
    handleDeleteRow,
    handleContextMenuBatchEdit,
    handleBatchEditSave,
    handleAddNewRow,
    handleSaveNewRowWithForm,
    handleCancelNewRow,
  };
}
