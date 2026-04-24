import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { logError } from "../../../../../lib/errorLog";
import { mysqlListTables } from "../../../services/queryClient";
import { executeTableSchemaQuery } from "../services/tableSchemaService";
import type { CreateTableColumn, CreateTableModalState, EditingRow } from "../types";

interface UseCreateTableReturn {
  createTableModal: CreateTableModalState | null;
  setCreateTableModal: (state: CreateTableModalState | null | ((prev: CreateTableModalState | null) => CreateTableModalState | null)) => void;
  createTableError: string;
  setCreateTableError: (error: string) => void;
  createTableLoading: boolean;
  createTableSuccess: string | null;
  setCreateTableSuccess: (success: string | null) => void;
  selectedEditingRowId: string | null;
  setSelectedEditingRowId: (rowId: string | null) => void;
  editingRows: EditingRow[];
  setEditingRows: (rows: EditingRow[] | ((prev: EditingRow[]) => EditingRow[])) => void;
  handleAddColumn: () => void;
  handleDeleteColumn: (columnId: string) => void;
  openCreateTable: (database: string) => void;
  generateCreateTableSQL: (state: CreateTableModalState) => string;
  handleCreateTable: () => Promise<void>;
}

interface UseCreateTableProps {
  connectionId: string | null | undefined;
  tablesByDb: Record<string, string[]>;
  setTablesByDb: (state: Record<string, string[]> | ((prev: Record<string, string[]>) => Record<string, string[]>)) => void;
  onError?: (error: Error | string) => void;
}

const DEFAULT_EDITING_ROW: EditingRow = {
  id: Date.now().toString(),
  name: "",
  type: "varchar",
  length: "255",
  scale: "",
  nullable: true,
  defaultValue: "",
  isPrimary: false,
  autoIncrement: false,
  comment: "",
  timestampDefault: "none",
  timestampOnUpdate: false,
  extraAttributes: ""
};

export function useCreateTable({
  connectionId,
  tablesByDb,
  setTablesByDb,
  onError
}: UseCreateTableProps): UseCreateTableReturn {
  const { t } = useTranslation();

  const [createTableModal, setCreateTableModal] = useState<CreateTableModalState | null>(null);
  const [createTableError, setCreateTableError] = useState("");
  const [createTableLoading, setCreateTableLoading] = useState(false);
  const [createTableSuccess, setCreateTableSuccess] = useState<string | null>(null);
  const [selectedEditingRowId, setSelectedEditingRowId] = useState<string | null>(null);
  const [editingRows, setEditingRows] = useState<EditingRow[]>([{ ...DEFAULT_EDITING_ROW, id: Date.now().toString() }]);

  const handleAddColumn = useCallback(() => {
    const newId = Date.now().toString();
    setEditingRows((prev) => [...prev, {
      id: newId,
      name: "",
      type: "varchar",
      length: "255",
      scale: "",
      nullable: true,
      defaultValue: "",
      isPrimary: false,
      autoIncrement: false,
      comment: "",
      timestampDefault: "none",
      timestampOnUpdate: false,
      extraAttributes: ""
    }]);
  }, []);

  const handleDeleteColumn = useCallback((columnId: string) => {
    if (!createTableModal) return;

    setCreateTableModal((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        columns: prev.columns.filter(col => col.id !== columnId)
      };
    });
  }, [createTableModal]);

  const openCreateTable = useCallback((database: string) => {
    setCreateTableModal({
      database,
      tableName: "",
      columns: [],
      charset: "utf8mb4",
      engine: "InnoDB"
    });
    setCreateTableError("");
    setSelectedEditingRowId(null);
    setEditingRows([{ ...DEFAULT_EDITING_ROW, id: Date.now().toString() }]);
  }, []);

  const generateCreateTableSQL = useCallback((state: CreateTableModalState): string => {
    const { tableName, columns, charset, engine, database } = state;

    if (!tableName.trim() || columns.length === 0) {
      return "";
    }

    const backtick = (str: string) => `\`${str.replace(/`/g, '``')}\``;
    const tableFull = `${backtick(database)}.${backtick(tableName)}`;

    const columnDefs = columns.map(col => {
      let def = `${backtick(col.name)} ${col.type}`;

      if (col.length && (col.type === "varchar" || col.type === "char")) {
        def += `(${col.length})`;
      } else if (col.length && col.scale && (col.type === "decimal" || col.type === "float" || col.type === "double")) {
        def += `(${col.length},${col.scale})`;
      }

      if (!col.nullable) {
        def += " NOT NULL";
      }

      // Handle timestamp-specific properties
      if (col.type === "timestamp" || col.type === "datetime") {
        const tsProps = col as any;
        if (tsProps.timestampDefault === "current_timestamp") {
          def += " DEFAULT CURRENT_TIMESTAMP";
        } else if (col.defaultValue) {
          if (col.defaultValue.toUpperCase() === "CURRENT_TIMESTAMP") {
            def += " DEFAULT CURRENT_TIMESTAMP";
          } else {
            def += ` DEFAULT '${col.defaultValue.replace(/'/g, "''")}'`;
          }
        }

        if (tsProps.timestampOnUpdate) {
          def += " ON UPDATE CURRENT_TIMESTAMP";
        }
      } else if (col.defaultValue) {
        if (col.defaultValue.toUpperCase() === "CURRENT_TIMESTAMP") {
          def += " DEFAULT CURRENT_TIMESTAMP";
        } else {
          def += ` DEFAULT '${col.defaultValue.replace(/'/g, "''")}'`;
        }
      }

      if (col.autoIncrement) {
        def += " AUTO_INCREMENT";
      }

      if (col.isPrimary) {
        def += " PRIMARY KEY";
      }

      if (col.comment) {
        def += ` COMMENT '${col.comment.replace(/'/g, "''")}'`;
      }

      // Add extra attributes
      if ((col as any).extraAttributes) {
        def += ` ${(col as any).extraAttributes}`;
      }

      return def;
    }).join(",\n  ");

    return `CREATE TABLE ${tableFull} (\n  ${columnDefs}\n) ENGINE=${engine} DEFAULT CHARSET=${charset};`;
  }, []);

  const handleCreateTable = useCallback(async () => {
    if (!createTableModal || !connectionId) return;

    const { tableName, database } = createTableModal;

    if (!tableName.trim()) {
      setCreateTableError(t("connections.nameAndAddressRequired"));
      return;
    }

    // Summarize editing rows - filter out rows without column names
    const editingColumnsToAdd = editingRows
      .filter(row => row.name.trim())
      .map(row => ({
        id: row.id,
        name: row.name.trim(),
        type: row.type,
        length: row.length,
        scale: row.scale,
        nullable: row.nullable,
        defaultValue: row.defaultValue,
        isPrimary: row.isPrimary,
        autoIncrement: row.autoIncrement,
        comment: row.comment,
        timestampDefault: row.timestampDefault,
        timestampOnUpdate: row.timestampOnUpdate,
        extraAttributes: row.extraAttributes
      } as CreateTableColumn));

    // Merge existing columns and valid editing rows
    const allColumns = [...createTableModal.columns, ...editingColumnsToAdd];

    if (allColumns.length === 0) {
      setCreateTableError(t("mysql.tableManager.noColumns"));
      return;
    }

    // Check if table already exists
    const existingTables = tablesByDb[database] ?? [];
    if (existingTables.includes(tableName.trim())) {
      setCreateTableError(t("mysql.tableManager.tableAlreadyExists", { name: tableName.trim(), database }));
      return;
    }

    // Generate CREATE TABLE SQL
    const modalStateWithAllColumns: CreateTableModalState = {
      ...createTableModal,
      columns: allColumns
    };
    const sql = generateCreateTableSQL(modalStateWithAllColumns);
    if (!sql) {
      setCreateTableError("Failed to generate SQL");
      return;
    }

    setCreateTableLoading(true);
    setCreateTableError("");

    try {
      await executeTableSchemaQuery(connectionId, sql);

      // Refresh the database tables to show new table
      if (database) {
        const newTables = await mysqlListTables(connectionId, database);
        if (newTables) {
          setTablesByDb((prev) => ({
            ...prev,
            [database]: newTables
          }));
        }
      }

      setCreateTableSuccess(tableName);
      setCreateTableModal(null);
      setSelectedEditingRowId(null);
      setEditingRows([{ ...DEFAULT_EDITING_ROW, id: Date.now().toString() }]);
    } catch (err) {
      logError(err, {
        source: "useCreateTable.createTable",
        message: `Failed to create table ${tableName}`
      });
      const errorMsg = err instanceof Error ? err.message : String(err);
      setCreateTableError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setCreateTableLoading(false);
    }
  }, [createTableModal, connectionId, editingRows, generateCreateTableSQL, tablesByDb, t, setTablesByDb, onError]);

  return {
    createTableModal,
    setCreateTableModal,
    createTableError,
    setCreateTableError,
    createTableLoading,
    createTableSuccess,
    setCreateTableSuccess,
    selectedEditingRowId,
    setSelectedEditingRowId,
    editingRows,
    setEditingRows,
    handleAddColumn,
    handleDeleteColumn,
    openCreateTable,
    generateCreateTableSQL,
    handleCreateTable
  };
}
