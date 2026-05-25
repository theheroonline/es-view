import { Modal } from "antd";
import { useCallback } from "react";
import type { MysqlFilterNode } from "../../../types";
import {
    createFilterCondition,
    createFilterGroup,
    escapeSqlLiteral,
    type DataState,
    type FilterConditionDraft,
    type FilterGroupDraft,
    type RowContextMenu,
    type SelectedCell,
    type TableInfo,
} from "../utils";

interface UseTableContextMenuActionsProps {
  selectedCells: SelectedCell[];
  dataState: DataState;
  selectedTableInfo: TableInfo | null;
  rowContextMenu: RowContextMenu | null;
  activeFilterTree: MysqlFilterNode | null;
  t: (key: string, options?: any) => string;
  escapeSqlIdentifier: (value: string) => string;
  copyToClipboard: (value: string) => Promise<void>;
  applyFilter: (tree: FilterGroupDraft | null) => Promise<void>;
  applySort: (column: string, direction: "asc" | "desc") => Promise<void>;
  handleDeleteRow: (index: number) => Promise<void>;
  updateRowByIndex: (rowIndex: number, updates: Record<string, unknown>, options?: { refresh?: boolean }) => Promise<void>;
  handleContextMenuBatchEdit: () => void;
  setRowContextMenu: (menu: RowContextMenu | null) => void;
}

function formatSqlValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  return escapeSqlLiteral(String(value));
}

function appendConditionToRootTree(tree: MysqlFilterNode | null, condition: FilterConditionDraft): FilterGroupDraft {
  if (!tree || tree.kind !== "group") {
    return createFilterGroup("and", [condition]);
  }
  return {
    ...tree,
    children: [...tree.children, condition]
  };
}

export function useTableContextMenuActions({
  selectedCells,
  dataState,
  selectedTableInfo,
  rowContextMenu,
  activeFilterTree,
  t,
  escapeSqlIdentifier,
  copyToClipboard,
  applyFilter,
  applySort,
  handleDeleteRow,
  updateRowByIndex,
  handleContextMenuBatchEdit,
  setRowContextMenu,
}: UseTableContextMenuActionsProps) {
  const closeRowMenu = useCallback(() => {
    setRowContextMenu(null);
  }, [setRowContextMenu]);

  const handleContextMenuCopyRow = useCallback(() => {
    if (selectedCells.length === 0) return;

    const selectedRowIndexes = Array.from(new Set(selectedCells.map((cell) => cell.rowIndex)));
    const rows = selectedRowIndexes.map((rowIndex) => {
      const row = dataState.rows[rowIndex] ?? [];
      return Object.fromEntries(dataState.columns.map((column, index) => [column, row[index]]));
    });

    void copyToClipboard(JSON.stringify(rows, null, 2));
    closeRowMenu();
  }, [closeRowMenu, copyToClipboard, dataState.columns, dataState.rows, selectedCells]);

  const handleContextMenuCopyInsert = useCallback(() => {
    if (!selectedTableInfo || selectedCells.length === 0) return;

    const selectedRowIndexes = Array.from(new Set(selectedCells.map((cell) => cell.rowIndex)));
    const sqlStatements = selectedRowIndexes.map((rowIndex) => {
      const row = dataState.rows[rowIndex] ?? [];
      const columns = dataState.columns.map((column) => escapeSqlIdentifier(column)).join(", ");
      const values = row.map((value) => formatSqlValue(value)).join(", ");
      return `INSERT INTO ${escapeSqlIdentifier(selectedTableInfo.database)}.${escapeSqlIdentifier(selectedTableInfo.table)} (${columns}) VALUES (${values});`;
    });

    void copyToClipboard(sqlStatements.join("\n"));
    closeRowMenu();
  }, [closeRowMenu, copyToClipboard, dataState.columns, dataState.rows, escapeSqlIdentifier, selectedCells, selectedTableInfo]);

  const handleContextMenuCopyUpdate = useCallback(() => {
    if (!selectedTableInfo || selectedCells.length === 0) return;

    const selectedRowIndexes = Array.from(new Set(selectedCells.map((cell) => cell.rowIndex)));
    const primaryKeyColumns = selectedTableInfo.columns
      ?.filter((column) => column.key === "PRI")
      .map((column) => column.field) ?? [];

    if (primaryKeyColumns.length === 0) {
      Modal.info({
        title: t("common.notice"),
        content: t("mysql.tableManager.noPrimaryKey")
      });
      return;
    }

    const sqlStatements = selectedRowIndexes.map((rowIndex) => {
      const row = dataState.rows[rowIndex] ?? [];
      const setClause = dataState.columns
        .map((column, index) => `${escapeSqlIdentifier(column)} = ${formatSqlValue(row[index])}`)
        .join(", ");

      const whereClause = primaryKeyColumns
        .map((pkColumn) => {
          const pkIndex = dataState.columns.indexOf(pkColumn);
          const pkValue = pkIndex >= 0 ? row[pkIndex] : null;
          return `${escapeSqlIdentifier(pkColumn)} = ${formatSqlValue(pkValue)}`;
        })
        .join(" AND ");

      return `UPDATE ${escapeSqlIdentifier(selectedTableInfo.database)}.${escapeSqlIdentifier(selectedTableInfo.table)} SET ${setClause} WHERE ${whereClause};`;
    });

    void copyToClipboard(sqlStatements.join("\n"));
    closeRowMenu();
  }, [closeRowMenu, copyToClipboard, dataState.columns, dataState.rows, escapeSqlIdentifier, selectedCells, selectedTableInfo, t]);

  const handleContextMenuFilterByValue = useCallback(() => {
    if (!rowContextMenu) return;

    void applyFilter(appendConditionToRootTree(
      activeFilterTree,
      createFilterCondition(
        rowContextMenu.column,
        rowContextMenu.value === null
          ? "isNull"
          : typeof rowContextMenu.value === "string" && rowContextMenu.value === ""
            ? "emptyString"
            : "eq",
        rowContextMenu.value === null ? "" : String(rowContextMenu.value)
      )
    ));
    closeRowMenu();
  }, [activeFilterTree, applyFilter, closeRowMenu, rowContextMenu]);

  const handleContextMenuSortAsc = useCallback(() => {
    if (!rowContextMenu) return;
    void applySort(rowContextMenu.column, "asc");
    closeRowMenu();
  }, [applySort, closeRowMenu, rowContextMenu]);

  const handleContextMenuSortDesc = useCallback(() => {
    if (!rowContextMenu) return;
    void applySort(rowContextMenu.column, "desc");
    closeRowMenu();
  }, [applySort, closeRowMenu, rowContextMenu]);

  const handleContextMenuDelete = useCallback(() => {
    if (!rowContextMenu) return;
    void handleDeleteRow(rowContextMenu.rowIndex);
    closeRowMenu();
  }, [closeRowMenu, handleDeleteRow, rowContextMenu]);

  const handleContextMenuSetNull = useCallback(() => {
    if (!rowContextMenu) return;
    void updateRowByIndex(rowContextMenu.rowIndex, {
      [rowContextMenu.column]: null
    }, { refresh: false });
    closeRowMenu();
  }, [closeRowMenu, rowContextMenu, updateRowByIndex]);

  const handleContextMenuSetEmptyString = useCallback(() => {
    if (!rowContextMenu) return;
    void updateRowByIndex(rowContextMenu.rowIndex, {
      [rowContextMenu.column]: ""
    }, { refresh: false });
    closeRowMenu();
  }, [closeRowMenu, rowContextMenu, updateRowByIndex]);

  const handleContextMenuBatchEditWithClose = useCallback(() => {
    handleContextMenuBatchEdit();
    closeRowMenu();
  }, [closeRowMenu, handleContextMenuBatchEdit]);

  return {
    handleContextMenuCopyRow,
    handleContextMenuCopyInsert,
    handleContextMenuCopyUpdate,
    handleContextMenuFilterByValue,
    handleContextMenuSortAsc,
    handleContextMenuSortDesc,
    handleContextMenuDelete,
    handleContextMenuSetNull,
    handleContextMenuSetEmptyString,
    handleContextMenuBatchEditWithClose,
  };
}
