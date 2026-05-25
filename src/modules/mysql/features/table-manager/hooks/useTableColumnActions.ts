import { useCallback } from "react";
import { logError } from "../../../../../lib/errorLog";
import type { ColumnMeta } from "../../../types";
import { executeTableSchemaQuery } from "../services/tableSchemaService";
import {
    buildColumnType,
    parseColumnType,
    type ColumnEditForm,
    type ColumnEditMode,
    type RightPanelTab,
    type TableInfo,
} from "../utils";

interface ConfirmDialogState {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  isDangerous?: boolean;
}

interface UseTableColumnActionsProps {
  connectionId: string | null | undefined;
  selectedTableInfo: TableInfo | null;
  rightPanelTab: RightPanelTab;
  columnEditMode: ColumnEditMode;
  columnEditForm: ColumnEditForm;
  handleOpenTable: (db: string, table: string, targetTab: RightPanelTab) => Promise<void>;
  setColumnEditMode: (mode: ColumnEditMode) => void;
  setColumnEditOriginalField: (field: string) => void;
  setColumnEditForm: (form: ColumnEditForm) => void;
  setColumnEditError: (error: string) => void;
  setColumnEditOpen: (open: boolean) => void;
  setColumnEditLoading: (loading: boolean) => void;
  setConfirmDialog: (dialog: ConfirmDialogState) => void;
  setError: (error: string) => void;
  t: (key: string, options?: any) => string;
}

export function useTableColumnActions({
  connectionId,
  selectedTableInfo,
  rightPanelTab,
  columnEditMode,
  columnEditForm,
  handleOpenTable,
  setColumnEditMode,
  setColumnEditOriginalField,
  setColumnEditForm,
  setColumnEditError,
  setColumnEditOpen,
  setColumnEditLoading,
  setConfirmDialog,
  setError,
  t,
}: UseTableColumnActionsProps) {
  const openAddColumnModal = useCallback(() => {
    setColumnEditMode("add");
    setColumnEditOriginalField("");
    setColumnEditForm({
      field: "",
      typeName: "varchar",
      length: "255",
      scale: "",
      unsigned: false,
      customType: "",
      nullable: true,
      defaultValue: "",
      extra: "",
      autoIncrement: false
    });
    setColumnEditError("");
    setColumnEditOpen(true);
  }, [setColumnEditError, setColumnEditForm, setColumnEditMode, setColumnEditOpen, setColumnEditOriginalField]);

  const openEditColumnModal = useCallback((column: ColumnMeta) => {
    setColumnEditMode("edit");
    setColumnEditOriginalField(column.field);
    const parsedType = parseColumnType(column.type);
    setColumnEditForm({
      field: column.field,
      ...parsedType,
      nullable: column.null === "YES",
      defaultValue: column.default ?? "",
      extra: column.extra ?? "",
      autoIncrement: column.extra?.includes("auto_increment") ?? false
    });
    setColumnEditError("");
    setColumnEditOpen(true);
  }, [setColumnEditError, setColumnEditForm, setColumnEditMode, setColumnEditOpen, setColumnEditOriginalField]);

  const buildDefaultClause = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^null$/i.test(trimmed)) return " DEFAULT NULL";
    if (/^(current_timestamp(?:\(\))?|now\(\))$/i.test(trimmed)) {
      return ` DEFAULT ${trimmed}`;
    }
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return ` DEFAULT ${trimmed}`;
    }
    return ` DEFAULT '${trimmed.replace(/'/g, "''")}'`;
  }, []);

  const refreshSelectedTableInfo = useCallback(async () => {
    if (!selectedTableInfo) return;
    await handleOpenTable(selectedTableInfo.database, selectedTableInfo.table, rightPanelTab);
  }, [handleOpenTable, rightPanelTab, selectedTableInfo]);

  const handleSaveColumnEdit = useCallback(async () => {
    if (!connectionId || !selectedTableInfo) return;

    const field = columnEditForm.field.trim();
    const type = buildColumnType(columnEditForm).trim();
    let extra = columnEditForm.extra.trim();

    if (columnEditForm.autoIncrement) {
      if (!extra.toUpperCase().includes("AUTO_INCREMENT")) {
        extra = extra ? `${extra} AUTO_INCREMENT` : "AUTO_INCREMENT";
      }
    } else {
      extra = extra.replace(/AUTO_INCREMENT/gi, "").trim();
    }

    if (!field || !type) {
      setColumnEditError(t("connections.nameAndAddressRequired"));
      return;
    }

    const nullClause = columnEditForm.nullable ? " NULL" : " NOT NULL";
    const defaultClause = buildDefaultClause(columnEditForm.defaultValue);
    const extraClause = extra ? ` ${extra}` : "";

    const definition = `\`${field}\` ${type}${nullClause}${defaultClause}${extraClause}`;
    const sql = columnEditMode === "add"
      ? `ALTER TABLE \`${selectedTableInfo.database}\`.\`${selectedTableInfo.table}\` ADD COLUMN ${definition}`
      : `ALTER TABLE \`${selectedTableInfo.database}\`.\`${selectedTableInfo.table}\` MODIFY COLUMN ${definition}`;

    try {
      setColumnEditLoading(true);
      setColumnEditError("");
      await executeTableSchemaQuery(connectionId, sql);
      setColumnEditOpen(false);
      await refreshSelectedTableInfo();
    } catch (err) {
      logError(err, {
        source: "mysqlTableManager.saveColumnEdit",
        message: `Failed to ${columnEditMode === "add" ? "add" : "modify"} column ${field}`
      });
      setColumnEditError(err instanceof Error ? err.message : String(err));
    } finally {
      setColumnEditLoading(false);
    }
  }, [buildDefaultClause, columnEditForm, columnEditMode, connectionId, refreshSelectedTableInfo, selectedTableInfo, setColumnEditError, setColumnEditLoading, setColumnEditOpen, t]);

  const buildColumnDefinitionFromMeta = useCallback((column: ColumnMeta) => {
    const parsedType = parseColumnType(column.type);
    const type = buildColumnType({
      field: column.field,
      ...parsedType,
      nullable: column.null === "YES",
      defaultValue: column.default ?? "",
      extra: column.extra ?? "",
      autoIncrement: column.extra?.includes("auto_increment") ?? false
    }).trim();
    const nullClause = column.null === "YES" ? " NULL" : " NOT NULL";
    const defaultClause = buildDefaultClause(column.default ?? "");
    const extraClause = column.extra ? ` ${column.extra}` : "";
    return `\`${column.field}\` ${type}${nullClause}${defaultClause}${extraClause}`;
  }, [buildDefaultClause]);

  const handleMoveColumn = useCallback(async (column: ColumnMeta, direction: "up" | "down") => {
    if (!connectionId || !selectedTableInfo?.columns) return;

    const columns = selectedTableInfo.columns;
    const currentIndex = columns.findIndex((item) => item.field === column.field);
    if (currentIndex < 0) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= columns.length) return;

    const positionClause = targetIndex === 0
      ? " FIRST"
      : ` AFTER \`${columns[targetIndex - 1].field}\``;
    const sql = `ALTER TABLE \`${selectedTableInfo.database}\`.\`${selectedTableInfo.table}\` MODIFY COLUMN ${buildColumnDefinitionFromMeta(column)}${positionClause}`;

    try {
      await executeTableSchemaQuery(connectionId, sql);
      await refreshSelectedTableInfo();
    } catch (err) {
      logError(err, {
        source: "mysqlTableManager.moveColumn",
        message: `Failed to move column ${column.field} ${direction}`
      });
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [buildColumnDefinitionFromMeta, connectionId, refreshSelectedTableInfo, selectedTableInfo, setError]);

  const handleDropColumn = useCallback(async (column: ColumnMeta) => {
    if (!connectionId || !selectedTableInfo) return;

    const onConfirm = async () => {
      try {
        await executeTableSchemaQuery(
          connectionId,
          `ALTER TABLE \`${selectedTableInfo.database}\`.\`${selectedTableInfo.table}\` DROP COLUMN \`${column.field}\``
        );
        await refreshSelectedTableInfo();
      } catch (err) {
        logError(err, {
          source: "mysqlTableManager.dropColumn",
          message: `Failed to drop column ${column.field}`
        });
        setError(err instanceof Error ? err.message : String(err));
      }
    };

    setConfirmDialog({
      open: true,
      title: t("mysql.tableManager.dropColumn"),
      message: t("mysql.tableManager.dropColumnConfirm", {
        column: `\`${column.field}\``,
        table: `\`${selectedTableInfo.database}\`.\`${selectedTableInfo.table}\``
      }),
      isDangerous: true,
      onConfirm
    });
  }, [connectionId, refreshSelectedTableInfo, selectedTableInfo, setConfirmDialog, setError, t]);

  return {
    openAddColumnModal,
    openEditColumnModal,
    handleSaveColumnEdit,
    handleMoveColumn,
    handleDropColumn,
  };
}
