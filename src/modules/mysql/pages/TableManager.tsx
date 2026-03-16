import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { logError } from "../../../lib/errorLog";
import {
  getMysqlOpenedTableKey,
  type MysqlFilterOperator,
  type MysqlFilterNode,
  type MysqlOpenedTable,
  useMysqlContext
} from "../../../state/MysqlContext";
import {
  mysqlCreateIndex,
  mysqlDescribeTable,
  mysqlDropIndex,
  mysqlExportTable,
  mysqlExportTables,
  mysqlImportSql,
  mysqlListDatabases,
  mysqlListIndexes,
  mysqlListTables,
  mysqlQuery,
} from "../services/client";
import type { ColumnMeta, IndexMeta } from "../types";
import { DatabaseOverviewPanel } from "./table-manager/components/DatabaseOverviewPanel";
import { StructureTabPanel } from "./table-manager/components/StructureTabPanel";
import { InfoTabPanel } from "./table-manager/components/InfoTabPanel";
import { DataTabPanel } from "./table-manager/components/DataTabPanel";
import { BatchEditModal } from "./table-manager/components/BatchEditModal";
import { CreateTableModal } from "./table-manager/components/CreateTableModal";
import {
  type FilterConditionDraft,
  type FilterGroupDraft,
  type TableInfo,
  type TableDetailInfo,
  type DataState,
  type RightPanelTab,
  type SelectedCell,
  type ColumnEditForm,
  type TreeContextMenu,
  type DatabaseContextMenu,
  type ExportSelectionModalState,
  type CreateTableModalState,
  type RowContextMenu,
  type ColumnHeaderContextMenu,
  type CellEditorState,
  type BatchEditMode,
  type ColumnEditMode,
  defaultDataState,
  mysqlColumnTypeOptions,
  getColumnTypeOption,
  escapeSqlIdentifier,
  escapeSqlLiteral,
  escapeSqlLikeLiteral,
  parseColumnType,
  buildColumnType,
  formatInfoDate,
  formatInfoText,
  toSafeNumber,
  getSingleResultRow,
  createFilterCondition,
  createFilterGroup,
  cloneFilterGroup,
  sanitizeFilterNode
} from "./table-manager/utils";

export default function MysqlTableManager() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    activeMysqlConnection,
    setDatabases,
    tablesByDb,
    setTablesByDb,
    expandedDatabase,
    setExpandedDatabase,
    selectedDatabase,
    selectedTable,
    setSelectedDatabase,
    setSelectedTable,
    openedTables,
    setOpenedTables,
    activeOpenedTableKey,
    setActiveOpenedTableKey
  } = useMysqlContext();
  const [selectedTableInfo, setSelectedTableInfo] = useState<TableInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Right panel tab
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>("structure");

  // Tree context menu
  const [treeContextMenu, setTreeContextMenu] = useState<TreeContextMenu | null>(null);
  const [databaseContextMenu, setDatabaseContextMenu] = useState<DatabaseContextMenu | null>(null);
  const [rowContextMenu, setRowContextMenu] = useState<RowContextMenu | null>(null);
  const [columnHeaderContextMenu, setColumnHeaderContextMenu] = useState<ColumnHeaderContextMenu | null>(null);
  const [selectedOverviewTables, setSelectedOverviewTables] = useState<string[]>([]);
  const [overviewSelectionAnchor, setOverviewSelectionAnchor] = useState<string | null>(null);
  const [exportSelectionModal, setExportSelectionModal] = useState<ExportSelectionModalState | null>(null);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);
  const [createTableModal, setCreateTableModal] = useState<CreateTableModalState | null>(null);
  const [createTableError, setCreateTableError] = useState("");
  const [createTableLoading, setCreateTableLoading] = useState(false);
  const [createTableSuccess, setCreateTableSuccess] = useState<string | null>(null);
  const [selectedEditingRowId, setSelectedEditingRowId] = useState<string | null>(null);
  const [editingRows, setEditingRows] = useState<Array<{
    id: string;
    name: string;
    type: string;
    length: string;
    scale: string;
    nullable: boolean;
    defaultValue: string;
    isPrimary: boolean;
    autoIncrement: boolean;
    comment: string;
    timestampDefault?: "none" | "current_timestamp";
    timestampOnUpdate?: boolean;
    extraAttributes?: string;
  }>>([{
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
  }]);
  const selectedOverviewTablesRef = useRef<string[]>([]);

  // Data browsing state
  const [dataState, setDataState] = useState<DataState>(defaultDataState);
  const [dataColumnMeta, setDataColumnMeta] = useState<ColumnMeta[]>([]);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [editingRow, setEditingRow] = useState<{ index: number; json: string } | null>(null);
  const [editingCell, setEditingCell] = useState<CellEditorState | null>(null);
  const [selectedCells, setSelectedCells] = useState<SelectedCell[]>([]);
  const [selectionAnchor, setSelectionAnchor] = useState<{ rowIndex: number; columnIndex: number } | null>(null);
  const [editError, setEditError] = useState("");
  const [addRowModalOpen, setAddRowModalOpen] = useState(false);
  const [addRowFormData, setAddRowFormData] = useState<Record<string, string>>({});
  const [addRowError, setAddRowError] = useState("");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [sortModalOpen, setSortModalOpen] = useState(false);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const [filterDraftTree, setFilterDraftTree] = useState<FilterGroupDraft | null>(null);
  const [sortDraft, setSortDraft] = useState<{ column: string; direction: "asc" | "desc" }>({
    column: "",
    direction: "asc"
  });
  const [batchEditOpen, setBatchEditOpen] = useState(false);
  const [batchEditDraft, setBatchEditDraft] = useState<{ mode: BatchEditMode; value: string }>({ mode: "text", value: "" });
  const [batchEditError, setBatchEditError] = useState("");

  // SQL execution modal state
  const [sqlModalOpen, setSqlModalOpen] = useState(false);
  const [sqlModalValue, setSqlModalValue] = useState("");
  const [sqlModalResult, setSqlModalResult] = useState("");
  const [sqlModalLoading, setSqlModalLoading] = useState(false);

  const [columnEditOpen, setColumnEditOpen] = useState(false);
  const [columnEditMode, setColumnEditMode] = useState<ColumnEditMode>("add");
  const [columnEditOriginalField, setColumnEditOriginalField] = useState<string>("");
  const [columnEditForm, setColumnEditForm] = useState<ColumnEditForm>({
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
  const [columnEditLoading, setColumnEditLoading] = useState(false);
  const [columnEditError, setColumnEditError] = useState("");

  // Index management state
  const [indexModalOpen, setIndexModalOpen] = useState(false);
  const [indexModalMode, setIndexModalMode] = useState<"view" | "create" | "edit">("view");
  const [indexes, setIndexes] = useState<IndexMeta[]>([]);
  const [indexLoading, setIndexLoading] = useState(false);
  const [indexError, setIndexError] = useState("");
  const [indexFormData, setIndexFormData] = useState({
    name: "",
    columns: [] as string[],
    unique: false,
    indexType: "BTREE"
  });

  const connectionId = activeMysqlConnection?.id;
  const isTableWorkspace = location.pathname === "/mysql/table";
  const activeOpenedTable = activeOpenedTableKey
    ? openedTables.find((item) => getMysqlOpenedTableKey(item.database, item.table) === activeOpenedTableKey) ?? null
    : null;

  const selectedCellKeySet = useMemo(() => new Set(selectedCells.map((cell) => cell.key)), [selectedCells]);

  const filterOperators: Array<{ value: MysqlFilterOperator; label: string }> = [
    { value: "eq", label: t("mysql.tableManager.operatorEq") },
    { value: "ne", label: t("mysql.tableManager.operatorNe") },
    { value: "gt", label: t("mysql.tableManager.operatorGt") },
    { value: "gte", label: t("mysql.tableManager.operatorGte") },
    { value: "lt", label: t("mysql.tableManager.operatorLt") },
    { value: "lte", label: t("mysql.tableManager.operatorLte") },
    { value: "contains", label: t("mysql.tableManager.operatorContains") },
    { value: "startsWith", label: t("mysql.tableManager.operatorStartsWith") },
    { value: "endsWith", label: t("mysql.tableManager.operatorEndsWith") },
    { value: "isNull", label: t("mysql.tableManager.operatorIsNull") },
    { value: "isNotNull", label: t("mysql.tableManager.operatorIsNotNull") },
    { value: "emptyString", label: t("mysql.tableManager.operatorEmptyString") },
    { value: "notEmptyString", label: t("mysql.tableManager.operatorNotEmptyString") }
  ];

  const activeFilterTree = activeOpenedTable?.filterTree ?? null;

  const createSelectedCell = (rowIndex: number, columnIndex: number): SelectedCell => ({
    key: `${rowIndex}:${columnIndex}`,
    rowIndex,
    columnIndex,
    column: dataState.columns[columnIndex] ?? ""
  });

  function buildNodeSql(node: MysqlFilterNode): string | null {
    if (node.kind === "condition") {
      return buildConditionSql(node);
    }

    const childSql = node.children
      .map((child) => buildNodeSql(child))
      .filter((part): part is string => Boolean(part));

    if (childSql.length === 0) return null;
    const joiner = node.mode === "or" ? " OR " : " AND ";
    return childSql.length === 1 ? childSql[0] : `(${childSql.join(joiner)})`;
  }

  const buildConditionSql = useCallback((condition: FilterConditionDraft) => {
    const column = condition.column.trim();
    if (!column) return null;

    const identifier = escapeSqlIdentifier(column);
    const conditionValue = condition.value ?? "";
    switch (condition.operator) {
      case "eq":
        return `${identifier} = ${escapeSqlLiteral(conditionValue)}`;
      case "ne":
        return `${identifier} <> ${escapeSqlLiteral(conditionValue)}`;
      case "gt":
        return `${identifier} > ${escapeSqlLiteral(conditionValue)}`;
      case "gte":
        return `${identifier} >= ${escapeSqlLiteral(conditionValue)}`;
      case "lt":
        return `${identifier} < ${escapeSqlLiteral(conditionValue)}`;
      case "lte":
        return `${identifier} <= ${escapeSqlLiteral(conditionValue)}`;
      case "contains":
        return `${identifier} LIKE '%${escapeSqlLikeLiteral(conditionValue)}%' ESCAPE '\\\\'`;
      case "startsWith":
        return `${identifier} LIKE '${escapeSqlLikeLiteral(conditionValue)}%' ESCAPE '\\\\'`;
      case "endsWith":
        return `${identifier} LIKE '%${escapeSqlLikeLiteral(conditionValue)}' ESCAPE '\\\\'`;
      case "isNull":
        return `${identifier} IS NULL`;
      case "isNotNull":
        return `${identifier} IS NOT NULL`;
      case "emptyString":
        return `${identifier} = ''`;
      case "notEmptyString":
        return `${identifier} <> ''`;
      default:
        return null;
    }
  }, []);

  const getWhereClause = useCallback((tree?: FilterGroupDraft | null) => {
    if (!tree) return "";
    const sql = buildNodeSql(tree);
    return sql ? ` WHERE ${sql}` : "";
  }, [buildConditionSql]);

  const syncFilterDraftFromOpenedTable = useCallback((table: MysqlOpenedTable | null, columns: string[]) => {
    const firstColumn = columns[0] ?? "";
    const tree = table?.filterTree
      ? cloneFilterGroup(table.filterTree, firstColumn)
      : createFilterGroup("and", [createFilterCondition(firstColumn)]);
    setFilterDraftTree(tree);
  }, []);

  // ─── Database / Table tree logic ───

  const refreshDatabases = useCallback(async () => {
    if (!connectionId) return;
    setLoading(true);
    try {
      const dbs = await mysqlListDatabases(connectionId);
      setDatabases(dbs);
      setTablesByDb((prev) => {
        const next: Record<string, string[]> = {};
        dbs.forEach((db) => {
          if (prev[db]) {
            next[db] = prev[db];
          }
        });
        return next;
      });
      if (expandedDatabase && !dbs.includes(expandedDatabase)) {
        setExpandedDatabase(null);
        setSelectedDatabase(undefined);
        setSelectedTable(undefined);
        setSelectedTableInfo(null);
        setDataState(defaultDataState);
      }
      const remainingOpenedTables = openedTables.filter((item) => dbs.includes(item.database));
      if (remainingOpenedTables.length !== openedTables.length) {
        setOpenedTables(remainingOpenedTables);
        const nextActiveKey = activeOpenedTableKey && remainingOpenedTables.some((item) => getMysqlOpenedTableKey(item.database, item.table) === activeOpenedTableKey)
          ? activeOpenedTableKey
          : null;
        setActiveOpenedTableKey(nextActiveKey);
        setSelectedTableInfo(null);
        setDataState(defaultDataState);
        if (location.pathname === "/mysql/table") {
          const hasActive = activeOpenedTableKey && remainingOpenedTables.some((item) => getMysqlOpenedTableKey(item.database, item.table) === activeOpenedTableKey);
          if (!hasActive) {
            void navigate("/mysql/tables");
          }
        }
      }
    } catch (err) {
      logError(err, {
        source: "mysqlTableManager.refreshDatabases",
        message: "Failed to refresh MySQL database tree"
      });
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [activeOpenedTableKey, connectionId, expandedDatabase, location.pathname, navigate, openedTables, setActiveOpenedTableKey, setDatabases, setExpandedDatabase, setOpenedTables, setSelectedDatabase, setSelectedTable, setTablesByDb]);

  useEffect(() => {
    refreshDatabases();
  }, [refreshDatabases]);

  const refreshTablesForDb = useCallback(async (db: string) => {
    if (!connectionId) return;
    try {
      const tbls = await mysqlListTables(connectionId, db);
      setTablesByDb((prev) => ({ ...prev, [db]: tbls }));
      if (expandedDatabase === db) {
        setSelectedOverviewTables((previous) => previous.filter((table) => tbls.includes(table)));
        setOverviewSelectionAnchor((previous) => (previous && tbls.includes(previous) ? previous : null));
      }
      if (selectedTableInfo?.database === db && selectedTableInfo.table && !tbls.includes(selectedTableInfo.table)) {
        setSelectedTableInfo(null);
        setDataState(defaultDataState);
      }
      if (selectedDatabase === db && selectedTable && !tbls.includes(selectedTable)) {
        setSelectedTable(undefined);
      }
      const remainingOpenedTables = openedTables.filter((item) => item.database !== db || tbls.includes(item.table));
      if (remainingOpenedTables.length !== openedTables.length) {
        setOpenedTables(remainingOpenedTables);
        const nextActiveKey = activeOpenedTableKey && remainingOpenedTables.some((item) => getMysqlOpenedTableKey(item.database, item.table) === activeOpenedTableKey)
          ? activeOpenedTableKey
          : null;
        setActiveOpenedTableKey(nextActiveKey);
        setSelectedTableInfo(null);
        setDataState(defaultDataState);
        if (location.pathname === "/mysql/table") {
          const hasActive = activeOpenedTableKey && remainingOpenedTables.some((item) => getMysqlOpenedTableKey(item.database, item.table) === activeOpenedTableKey);
          if (!hasActive) {
            void navigate("/mysql/tables");
          }
        }
      }
    } catch (error) {
      logError(error, {
        source: "mysqlTableManager.refreshTables",
        message: `Failed to refresh tables for database ${db}`
      });
      setTablesByDb((prev) => ({ ...prev, [db]: [] }));
    }
  }, [activeOpenedTableKey, connectionId, expandedDatabase, location.pathname, navigate, openedTables, selectedDatabase, selectedTable, selectedTableInfo, setActiveOpenedTableKey, setOpenedTables, setSelectedTable, setTablesByDb]);

  const loadTableInfo = useCallback(async (db: string, table: string) => {
    const [columns, countResult, statusResult, createResult] = await Promise.all([
      mysqlDescribeTable(connectionId!, db, table),
      mysqlQuery(connectionId!, `SELECT COUNT(*) as cnt FROM \`${db}\`.\`${table}\``),
      mysqlQuery(connectionId!, `SHOW TABLE STATUS FROM \`${db}\` LIKE ${escapeSqlLiteral(table)}`),
      mysqlQuery(connectionId!, `SHOW CREATE TABLE \`${db}\`.\`${table}\``)
    ]);

    const rowCount = countResult.isResultSet && countResult.rows.length > 0
      ? Number(countResult.rows[0][0]) || 0
      : 0;

    const statusRow = getSingleResultRow(statusResult.columns, statusResult.rows);
    const createTableRow = getSingleResultRow(createResult.columns, createResult.rows);
    const info: TableDetailInfo = {
      engine: formatInfoText(statusRow?.Engine),
      rowFormat: formatInfoText(statusRow?.Row_format),
      tableRows: toSafeNumber(statusRow?.Rows),
      autoIncrement: formatInfoText(statusRow?.Auto_increment),
      createTime: formatInfoDate(statusRow?.Create_time),
      updateTime: formatInfoDate(statusRow?.Update_time),
      checkTime: formatInfoDate(statusRow?.Check_time),
      collation: formatInfoText(statusRow?.Collation),
      indexLength: toSafeNumber(statusRow?.Index_length),
      dataLength: toSafeNumber(statusRow?.Data_length),
      maxDataLength: toSafeNumber(statusRow?.Max_data_length),
      dataFree: toSafeNumber(statusRow?.Data_free),
      avgRowLength: toSafeNumber(statusRow?.Avg_row_length),
      comment: formatInfoText(statusRow?.Comment),
      createOptions: formatInfoText(statusRow?.Create_options),
      createSql: formatInfoText(createTableRow?.["Create Table"])
    };

    return { columns, rowCount, info };
  }, [connectionId, escapeSqlLiteral]);

  const loadIndexes = useCallback(async (db: string, table: string) => {
    if (!connectionId) return;
    try {
      setIndexLoading(true);
      setIndexError("");
      const data = await mysqlListIndexes(connectionId, db, table);
      setIndexes(data);
    } catch (err) {
      logError(err, {
        source: "mysqlTableManager.loadIndexes",
        message: `Failed to load indexes for ${db}.${table}`
      });
      setIndexError(err instanceof Error ? err.message : String(err));
    } finally {
      setIndexLoading(false);
    }
  }, [connectionId]);

  const openIndexModal = useCallback(async () => {
    if (!selectedTableInfo) return;
    setIndexModalMode("view");
    setIndexFormData({ name: "", columns: [], unique: false, indexType: "BTREE" });
    setIndexModalOpen(true);
    await loadIndexes(selectedTableInfo.database, selectedTableInfo.table);
  }, [selectedTableInfo, loadIndexes]);

  const openCreateIndexModal = useCallback(() => {
    if (!selectedTableInfo) return;
    setIndexModalMode("create");
    setIndexFormData({ name: "", columns: [], unique: false, indexType: "BTREE" });
    setIndexModalOpen(true);
  }, [selectedTableInfo]);

  const handleCreateIndex = async () => {
    if (!selectedTableInfo || !connectionId || indexFormData.columns.length === 0) return;
    try {
      setIndexLoading(true);
      setIndexError("");
      await mysqlCreateIndex(
        connectionId,
        selectedTableInfo.database,
        selectedTableInfo.table,
        indexFormData.name,
        indexFormData.columns,
        indexFormData.unique,
        indexFormData.indexType
      );
      await loadIndexes(selectedTableInfo.database, selectedTableInfo.table);
      setIndexFormData({ name: "", columns: [], unique: false, indexType: "BTREE" });
      setIndexModalMode("view");
    } catch (err) {
      logError(err, {
        source: "mysqlTableManager.createIndex",
        message: `Failed to create index`
      });
      setIndexError(err instanceof Error ? err.message : String(err));
    } finally {
      setIndexLoading(false);
    }
  };

  const handleDropIndex = async (indexName: string) => {
    if (!selectedTableInfo || !connectionId) return;
    if (!confirm(`Are you sure you want to drop index "${indexName}"?`)) return;
    try {
      setIndexLoading(true);
      setIndexError("");
      await mysqlDropIndex(connectionId, selectedTableInfo.database, selectedTableInfo.table, indexName);
      await loadIndexes(selectedTableInfo.database, selectedTableInfo.table);
    } catch (err) {
      logError(err, {
        source: "mysqlTableManager.dropIndex",
        message: `Failed to drop index`
      });
      setIndexError(err instanceof Error ? err.message : String(err));
    } finally {
      setIndexLoading(false);
    }
  };

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
  }, [selectedTableInfo]);

  const handleUpdateIndex = async () => {
    if (!selectedTableInfo || !connectionId || indexFormData.columns.length === 0) return;
    const oldIndex = indexes.find(idx => idx.name === indexFormData.name);
    if (!oldIndex) return;

    try {
      setIndexLoading(true);
      setIndexError("");
      // Drop old index and create new one
      await mysqlDropIndex(connectionId, selectedTableInfo.database, selectedTableInfo.table, oldIndex.name);
      await mysqlCreateIndex(
        connectionId,
        selectedTableInfo.database,
        selectedTableInfo.table,
        indexFormData.name,
        indexFormData.columns,
        indexFormData.unique,
        indexFormData.indexType
      );
      await loadIndexes(selectedTableInfo.database, selectedTableInfo.table);
      setIndexFormData({ name: "", columns: [], unique: false, indexType: "BTREE" });
      setIndexModalMode("view");
    } catch (err) {
      logError(err, {
        source: "mysqlTableManager.updateIndex",
        message: `Failed to update index`
      });
      setIndexError(err instanceof Error ? err.message : String(err));
    } finally {
      setIndexLoading(false);
    }
  };

  const handleSelectTable = (db: string, table: string) => {
    setSelectedDatabase(db);
    setSelectedTable(table);
  };

  const getOrderedSelectedTables = useCallback((db: string, tables: string[]) => {
    const availableTables = tablesByDb[db] ?? [];
    const selectedSet = new Set(tables);
    return availableTables.filter((table) => selectedSet.has(table));
  }, [tablesByDb]);

  const handleOverviewTableClick = (event: MouseEvent<HTMLDivElement>, db: string, table: string) => {
    handleSelectTable(db, table);

    const availableTables = tablesByDb[db] ?? [];
    const canSelectRange = event.shiftKey && overviewSelectionAnchor && availableTables.includes(overviewSelectionAnchor);
    const isToggleSelection = event.ctrlKey || event.metaKey;

    setSelectedOverviewTables((previous) => {
      if (canSelectRange && overviewSelectionAnchor) {
        const startIndex = availableTables.indexOf(overviewSelectionAnchor);
        const endIndex = availableTables.indexOf(table);
        return availableTables.slice(Math.min(startIndex, endIndex), Math.max(startIndex, endIndex) + 1);
      }

      if (isToggleSelection) {
        return previous.includes(table)
          ? previous.filter((item) => item !== table)
          : getOrderedSelectedTables(db, [...previous, table]);
      }

      return [table];
    });

    setOverviewSelectionAnchor(table);
  };

  const clearOverviewTableSelection = useCallback(() => {
    setSelectedOverviewTables([]);
    setOverviewSelectionAnchor(null);
  }, []);

  useEffect(() => {
    selectedOverviewTablesRef.current = selectedOverviewTables;
  }, [selectedOverviewTables]);

  const handleOpenTable = async (db: string, table: string, targetTab: RightPanelTab) => {
    if (!connectionId) return;

    setSelectedDatabase(db);
    setSelectedTable(table);
    setSelectedTableInfo({ database: db, table, loading: true });
    setRightPanelTab(targetTab);

    try {
      const { columns, rowCount, info } = await loadTableInfo(db, table);
      setSelectedTableInfo({ database: db, table, columns, rowCount, info, loading: false });
      setDataColumnMeta(columns);

      if (targetTab === "data") {
        await fetchData(db, table, 1, defaultDataState.pageSize);
      } else {
        setDataState(defaultDataState);
      }
    } catch (err) {
      logError(err, {
        source: targetTab === "data" ? "mysqlTableManager.openTableData" : "mysqlTableManager.openTableStructure",
        message: `Failed to open table ${db}.${table}`
      });
      setSelectedTableInfo({ database: db, table, loading: false });
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const setOpenedTableView = useCallback((db: string, table: string, view: RightPanelTab) => {
    const nextKey = getMysqlOpenedTableKey(db, table);
    setOpenedTables((prev) => prev.map((item) => (
      getMysqlOpenedTableKey(item.database, item.table) === nextKey ? { ...item, view } : item
    )));
  }, [setOpenedTables]);

  const updateOpenedTableQueryState = useCallback(
    (
      db: string,
      table: string,
      next: Partial<Pick<MysqlOpenedTable, "filterTree" | "sortColumn" | "sortDirection">>
    ) => {
      const nextKey = getMysqlOpenedTableKey(db, table);
      setOpenedTables((prev) => prev.map((item) => (
        getMysqlOpenedTableKey(item.database, item.table) === nextKey
          ? { ...item, ...next }
          : item
      )));
    },
    [setOpenedTables]
  );

  const openTableWorkspace = async (db: string, table: string, targetTab: RightPanelTab) => {
    const nextKey = getMysqlOpenedTableKey(db, table);
    setSelectedDatabase(db);
    setSelectedTable(table);
    setOpenedTables((prev) => {
      const existing = prev.find((item) => getMysqlOpenedTableKey(item.database, item.table) === nextKey);
      if (existing) {
        return prev.map((item) => getMysqlOpenedTableKey(item.database, item.table) === nextKey ? { ...item, view: targetTab } : item);
      }
      return [...prev, { database: db, table, view: targetTab }];
    });
    setActiveOpenedTableKey(nextKey);
    await navigate("/mysql/table");
  };

  const handleBrowseData = async (db: string, table: string) => {
    await openTableWorkspace(db, table, "data");
  };

  const handleDesignTable = async (db: string, table: string) => {
    await openTableWorkspace(db, table, "structure");
  };

  useEffect(() => {
    if (!isTableWorkspace || !activeOpenedTable) return;
    void handleOpenTable(activeOpenedTable.database, activeOpenedTable.table, activeOpenedTable.view);
  }, [activeOpenedTable, isTableWorkspace]);

  useEffect(() => {
    if (!activeOpenedTable) return;
    syncFilterDraftFromOpenedTable(activeOpenedTable, dataState.columns);
  }, [activeOpenedTable, dataState.columns, syncFilterDraftFromOpenedTable]);

  useEffect(() => {
    if (!connectionId) {
      setSelectedTableInfo(null);
      setDataState(defaultDataState);
      setDataColumnMeta([]);
      clearOverviewTableSelection();
      return;
    }

    if (!expandedDatabase && !activeOpenedTable) {
      setSelectedTableInfo(null);
      setDataState(defaultDataState);
      setDataColumnMeta([]);
      setSelectedTable(undefined);
      clearOverviewTableSelection();
      return;
    }

    if (expandedDatabase && !tablesByDb[expandedDatabase]) {
      refreshTablesForDb(expandedDatabase);
    }

    if (selectedTableInfo && location.pathname !== "/mysql/table" && selectedTableInfo.database !== expandedDatabase) {
      setSelectedTableInfo(null);
      setDataState(defaultDataState);
      setDataColumnMeta([]);
      setSelectedTable(undefined);
      setRightPanelTab("structure");
    }
  }, [activeOpenedTable, clearOverviewTableSelection, connectionId, expandedDatabase, location.pathname, refreshTablesForDb, selectedTableInfo, setSelectedTable, tablesByDb]);

  useEffect(() => {
    clearOverviewTableSelection();
  }, [clearOverviewTableSelection, expandedDatabase]);

  const fetchData = useCallback(async (
    db?: string,
    table?: string,
    page?: number,
    pageSize?: number,
    overrides?: Partial<Pick<MysqlOpenedTable, "filterTree" | "sortColumn" | "sortDirection">>
  ) => {
    const targetDb = db ?? selectedTableInfo?.database;
    const targetTable = table ?? selectedTableInfo?.table;
    if (!connectionId || !targetDb || !targetTable) return;

    const currentPage = page ?? dataState.page;
    const currentSize = pageSize ?? dataState.pageSize;
    const offset = (currentPage - 1) * currentSize;
    const currentFilterTree = overrides?.filterTree ?? activeOpenedTable?.filterTree ?? undefined;
    const currentSortColumn = db && table && activeOpenedTable?.database === db && activeOpenedTable?.table === table
      ? overrides?.sortColumn ?? activeOpenedTable.sortColumn
      : selectedTableInfo?.database === targetDb && selectedTableInfo?.table === targetTable
        ? overrides?.sortColumn ?? activeOpenedTable?.sortColumn
        : undefined;
    const currentSortDirection = db && table && activeOpenedTable?.database === db && activeOpenedTable?.table === table
      ? overrides?.sortDirection ?? activeOpenedTable.sortDirection
      : selectedTableInfo?.database === targetDb && selectedTableInfo?.table === targetTable
        ? overrides?.sortDirection ?? activeOpenedTable?.sortDirection
        : undefined;

    const whereClause = getWhereClause(currentFilterTree);
    const orderClause = currentSortColumn
      ? ` ORDER BY ${escapeSqlIdentifier(currentSortColumn)} ${(currentSortDirection ?? "asc").toUpperCase()}`
      : "";

    setDataState((prev) => ({ ...prev, loading: true, error: "" }));

    try {
      const countResult = await mysqlQuery(
        connectionId,
        `SELECT COUNT(*) as cnt FROM \`${targetDb}\`.\`${targetTable}\`${whereClause}`
      );
      const total = countResult.isResultSet && countResult.rows.length > 0
        ? Number(countResult.rows[0][0]) || 0
        : 0;

      const dataResult = await mysqlQuery(
        connectionId,
        `SELECT * FROM \`${targetDb}\`.\`${targetTable}\`${whereClause}${orderClause} LIMIT ${offset}, ${currentSize}`
      );

      setDataState({
        columns: dataResult.columns,
        rows: dataResult.rows,
        total,
        page: currentPage,
        pageSize: currentSize,
        loading: false,
        error: ""
      });
    } catch (err) {
      logError(err, {
        source: "mysqlTableManager.fetchData",
        message: `Failed to fetch table data for ${targetDb}.${targetTable}`
      });
      setDataState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : String(err)
      }));
    }
  }, [activeOpenedTable, connectionId, dataState.page, dataState.pageSize, getWhereClause, selectedTableInfo?.database, selectedTableInfo?.table]);

  // ─── Data pagination ───

  const totalPages = Math.max(1, Math.ceil(dataState.total / dataState.pageSize));

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    fetchData(undefined, undefined, newPage);
  };

  const handlePageSizeChange = (newSize: number) => {
    fetchData(undefined, undefined, 1, newSize);
  };

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      logError(err, {
        source: "mysqlTableManager.copyClipboard",
        message: "Failed to copy content to clipboard"
      });
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const getRowObject = (rowIndex: number) => {
    const row = dataState.rows[rowIndex] ?? [];
    return Object.fromEntries(dataState.columns.map((col, index) => [col, row[index]]));
  };

  const visibleDataColumns = useMemo(
    () => {
      const preferred = activeOpenedTable?.visibleColumns;
      if (!preferred || preferred.length === 0) {
        return dataState.columns;
      }
      const nextColumns = preferred.filter((column) => dataState.columns.includes(column));
      return nextColumns.length > 0 ? nextColumns : dataState.columns;
    },
    [activeOpenedTable?.visibleColumns, dataState.columns]
  );

  const formatSqlValue = (value: unknown) => {
    if (value === null || value === undefined) return "NULL";
    if (typeof value === "number" || typeof value === "bigint") return String(value);
    if (typeof value === "boolean") return value ? "1" : "0";
    return escapeSqlLiteral(String(value));
  };

  const buildInsertSql = (rowIndex: number) => {
    if (!selectedTableInfo) return "";
    const row = dataState.rows[rowIndex] ?? [];
    const columns = dataState.columns.map((column) => escapeSqlIdentifier(column)).join(", ");
    const values = row.map((value) => formatSqlValue(value)).join(", ");
    return `INSERT INTO ${escapeSqlIdentifier(selectedTableInfo.database)}.${escapeSqlIdentifier(selectedTableInfo.table)} (${columns}) VALUES (${values});`;
  };

  const buildSelectedCells = (start: { rowIndex: number; columnIndex: number }, end: { rowIndex: number; columnIndex: number }) => {
    const rowStart = Math.min(start.rowIndex, end.rowIndex);
    const rowEnd = Math.max(start.rowIndex, end.rowIndex);
    const colStart = Math.min(start.columnIndex, end.columnIndex);
    const colEnd = Math.max(start.columnIndex, end.columnIndex);
    const cells: SelectedCell[] = [];

    for (let rowIndex = rowStart; rowIndex <= rowEnd; rowIndex += 1) {
      for (let columnIndex = colStart; columnIndex <= colEnd; columnIndex += 1) {
        const cell = createSelectedCell(rowIndex, columnIndex);
        if (cell.column) {
          cells.push(cell);
        }
      }
    }

    return cells;
  };

  const getContextTargetCells = (context: RowContextMenu): SelectedCell[] => {
    const currentCell = createSelectedCell(context.rowIndex, context.columnIndex);
    return selectedCellKeySet.has(currentCell.key) ? selectedCells : [currentCell];
  };

  const handleCellClick = (event: MouseEvent<HTMLTableCellElement>, rowIndex: number, columnIndex: number) => {
    const currentCell = createSelectedCell(rowIndex, columnIndex);
    if (!currentCell.column) return;

    if (event.shiftKey && selectionAnchor) {
      setSelectedCells(buildSelectedCells(selectionAnchor, { rowIndex, columnIndex }));
    } else if (event.ctrlKey || event.metaKey) {
      setSelectedCells((prev) => prev.some((cell) => cell.key === currentCell.key)
        ? prev.filter((cell) => cell.key !== currentCell.key)
        : [...prev, currentCell]);
      setSelectionAnchor({ rowIndex, columnIndex });
    } else {
      setSelectedCells([currentCell]);
      setSelectionAnchor({ rowIndex, columnIndex });
    }

    setSelectedRowIndex(rowIndex);
  };

  const appendConditionToRootTree = (tree: FilterGroupDraft | null, condition: FilterConditionDraft) => {
    if (!tree) {
      return createFilterGroup("and", [condition]);
    }
    return {
      ...tree,
      children: [...tree.children, condition]
    };
  };

  const updateOpenedTableVisibleColumns = useCallback((db: string, table: string, visibleColumns: string[]) => {
    const nextKey = getMysqlOpenedTableKey(db, table);
    setOpenedTables((prev) => prev.map((item) => (
      getMysqlOpenedTableKey(item.database, item.table) === nextKey
        ? { ...item, visibleColumns: visibleColumns.length > 0 ? visibleColumns : dataState.columns }
        : item
    )));
  }, [dataState.columns, setOpenedTables]);

  const handleVisibleColumnToggle = (column: string, checked: boolean) => {
    if (!activeOpenedTable) return;
    const nextColumns = checked
      ? [...visibleDataColumns, column]
      : visibleDataColumns.filter((item) => item !== column);
    updateOpenedTableVisibleColumns(activeOpenedTable.database, activeOpenedTable.table, nextColumns);
  };

  const handleSelectAllVisibleColumns = () => {
    if (!activeOpenedTable) return;
    updateOpenedTableVisibleColumns(activeOpenedTable.database, activeOpenedTable.table, dataState.columns);
  };

  const applyFilter = async (tree: FilterGroupDraft | null) => {
    if (!activeOpenedTable) return;
    const sanitizedTree = tree ? sanitizeFilterNode(tree) : null;

    updateOpenedTableQueryState(activeOpenedTable.database, activeOpenedTable.table, {
      filterTree: sanitizedTree?.kind === "group" ? sanitizedTree : undefined
    });
    await fetchData(activeOpenedTable.database, activeOpenedTable.table, 1, dataState.pageSize, {
      filterTree: sanitizedTree?.kind === "group" ? sanitizedTree : undefined
    });
  };

  const clearFilter = async () => {
    if (!activeOpenedTable) return;
    updateOpenedTableQueryState(activeOpenedTable.database, activeOpenedTable.table, {
      filterTree: undefined
    });
    syncFilterDraftFromOpenedTable({ ...activeOpenedTable, filterTree: undefined }, dataState.columns);
    await fetchData(activeOpenedTable.database, activeOpenedTable.table, 1, dataState.pageSize, {
      filterTree: undefined
    });
  };

  const applySort = async (column: string, direction: "asc" | "desc") => {
    if (!activeOpenedTable) return;
    updateOpenedTableQueryState(activeOpenedTable.database, activeOpenedTable.table, {
      sortColumn: column,
      sortDirection: direction
    });
    setSortModalOpen(false);
    await fetchData(activeOpenedTable.database, activeOpenedTable.table, 1, dataState.pageSize, {
      sortColumn: column,
      sortDirection: direction
    });
  };

  const clearSort = async () => {
    if (!activeOpenedTable) return;
    updateOpenedTableQueryState(activeOpenedTable.database, activeOpenedTable.table, {
      sortColumn: undefined,
      sortDirection: undefined
    });
    setSortModalOpen(false);
    await fetchData(activeOpenedTable.database, activeOpenedTable.table, 1, dataState.pageSize, {
      sortColumn: undefined,
      sortDirection: undefined
    });
  };

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
        setParts.push(`\`${col}\` = '${String(val).replace(/'/g, "''")}'`);
      }
    }

    const whereParts: string[] = [];
    const pkCol = dataColumnMeta.find((c) => c.key === "PRI");
    if (pkCol) {
      const colIndex = dataState.columns.indexOf(pkCol.field);
      if (colIndex >= 0) {
        const val = originalRow[colIndex];
        if (val === null) {
          whereParts.push(`\`${pkCol.field}\` IS NULL`);
        } else {
          whereParts.push(`\`${pkCol.field}\` = '${String(val).replace(/'/g, "''")}'`);
        }
      }
    } else {
      dataState.columns.forEach((col, index) => {
        const val = originalRow[index];
        if (val === null) {
          whereParts.push(`\`${col}\` IS NULL`);
        } else {
          whereParts.push(`\`${col}\` = '${String(val).replace(/'/g, "''")}'`);
        }
      });
    }

    if (setParts.length === 0 || whereParts.length === 0) return;
    const sql = `UPDATE \`${db}\`.\`${table}\` SET ${setParts.join(", ")} WHERE ${whereParts.join(" AND ")} LIMIT 1`;
    await mysqlQuery(connectionId, sql);
    if (options?.refresh !== false) {
      await fetchData();
    }
  }, [connectionId, dataColumnMeta, dataState.columns, dataState.rows, fetchData, selectedTableInfo]);

  const applyValueToCells = useCallback(async (cells: SelectedCell[], value: unknown) => {
    const updatesByRow = new Map<number, Record<string, unknown>>();
    cells.forEach((cell) => {
      const existing = updatesByRow.get(cell.rowIndex) ?? {};
      existing[cell.column] = value;
      updatesByRow.set(cell.rowIndex, existing);
    });

    for (const [rowIndex, updates] of Array.from(updatesByRow.entries()).sort((left, right) => left[0] - right[0])) {
      await updateRowByIndex(rowIndex, updates, { refresh: false });
    }
    await fetchData();
  }, [fetchData, updateRowByIndex]);

  const openBatchEditModal = (cells: SelectedCell[]) => {
    if (cells.length === 0) return;
    setBatchEditDraft({ mode: "text", value: "" });
    setBatchEditError("");
    setBatchEditOpen(true);
  };

  const handleSaveBatchEdit = async () => {
    try {
      const value = batchEditDraft.mode === "null"
        ? null
        : batchEditDraft.mode === "empty"
          ? ""
          : batchEditDraft.value;
      await applyValueToCells(selectedCells, value);
      setBatchEditOpen(false);
    } catch (err) {
      logError(err, {
        source: "mysqlTableManager.batchEditCells",
        message: "Failed to batch edit selected cells"
      });
      setBatchEditError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleEditCell = (rowIndex: number, column: string, value: unknown) => {
    setEditingCell({
      rowIndex,
      column,
      value: value === null ? "" : String(value)
    });
    setEditError("");
  };

  const handleSaveCellEdit = async () => {
    if (!editingCell) return;
    try {
      await updateRowByIndex(editingCell.rowIndex, { [editingCell.column]: editingCell.value });
      setEditingCell(null);
    } catch (err) {
      logError(err, {
        source: "mysqlTableManager.saveCellEdit",
        message: `Failed to update cell ${editingCell.column}`
      });
      setEditError(err instanceof Error ? err.message : String(err));
    }
  };

  // ─── Data editing ───

  const handleEditRow = (index: number) => {
    const row = dataState.rows[index];
    const obj: Record<string, unknown> = {};
    dataState.columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    setEditingRow({ index, json: JSON.stringify(obj, null, 2) });
    setEditError("");
  };

  const handleSaveEdit = async () => {
    if (!editingRow || !connectionId || !selectedTableInfo) return;

    try {
      const data = JSON.parse(editingRow.json) as Record<string, unknown>;
      await updateRowByIndex(editingRow.index, data);
      setEditingRow(null);
    } catch (err) {
      logError(err, {
        source: "mysqlTableManager.saveEdit",
        message: `Failed to update row in ${selectedTableInfo.database}.${selectedTableInfo.table}`
      });
      setEditError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteRow = async (index: number) => {
    if (!connectionId || !selectedTableInfo) return;
    const { database: db, table } = selectedTableInfo;

    const row = dataState.rows[index];
    const whereParts: string[] = [];
    const pkCol = dataColumnMeta.find((c) => c.key === "PRI");

    if (pkCol) {
      const colIndex = dataState.columns.indexOf(pkCol.field);
      if (colIndex >= 0) {
        const val = row[colIndex];
        if (val === null) {
          whereParts.push(`\`${pkCol.field}\` IS NULL`);
        } else {
          whereParts.push(`\`${pkCol.field}\` = '${String(val).replace(/'/g, "''")}'`);
        }
      }
    } else {
      dataState.columns.forEach((col, i) => {
        const val = row[i];
        if (val === null) {
          whereParts.push(`\`${col}\` IS NULL`);
        } else {
          whereParts.push(`\`${col}\` = '${String(val).replace(/'/g, "''")}'`);
        }
      });
    }

    if (whereParts.length === 0) return;
    if (!confirm(t("dataBrowser.deleteConfirm", { docId: String(row[0] ?? index) }))) return;

    try {
      const sql = `DELETE FROM \`${db}\`.\`${table}\` WHERE ${whereParts.join(" AND ")} LIMIT 1`;
      await mysqlQuery(connectionId, sql);
      fetchData();
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

  // ─── Add new row ───

  const handleAddNewRow = () => {
    if (!selectedTableInfo) return;
    // Initialize form with column defaults
    const formData: Record<string, string> = {};
    selectedTableInfo.columns?.forEach((col) => {
      // Use default value if available, otherwise empty string
      if (col.default !== null && col.default !== undefined && col.default !== "") {
        formData[col.field] = String(col.default);
      } else {
        formData[col.field] = "";
      }
    });
    setAddRowFormData(formData);
    setAddRowError("");
    setAddRowModalOpen(true);
  };

  const handleSaveNewRow = async () => {
    if (!connectionId || !selectedTableInfo) return;
    const { database: db, table } = selectedTableInfo;

    try {
      // Filter out empty values - let database use defaults
      const insertColumns: string[] = [];
      const insertValues: string[] = [];

      for (const [col, val] of Object.entries(addRowFormData)) {
        // Skip empty values to use database defaults
        if (val === "" || val === null) {
          continue;
        }

        insertColumns.push(`\`${col}\``);
        // Try to detect if value is a number
        if (!isNaN(Number(val)) && val !== "") {
          insertValues.push(String(val));
        } else if (val.toLowerCase() === "true" || val === "1") {
          insertValues.push("1");
        } else if (val.toLowerCase() === "false" || val === "0") {
          insertValues.push("0");
        } else {
          insertValues.push(`'${String(val).replace(/'/g, "''")}'`);
        }
      }

      if (insertColumns.length === 0) {
        // If all values are empty, use default INSERT for one column
        insertColumns.push(`\`${dataState.columns[0] ?? "id"}\``);
        insertValues.push("DEFAULT");
      }

      const sql = `INSERT INTO \`${db}\`.\`${table}\` (${insertColumns.join(", ")}) VALUES (${insertValues.join(", ")})`;
      await mysqlQuery(connectionId, sql);
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
  };

  const handleCancelNewRow = () => {
    setAddRowModalOpen(false);
    setAddRowFormData({});
    setAddRowError("");
  };

  // ─── Table operations ───

  const handleDropTable = async (db: string, table: string) => {
    if (!connectionId) return;
    if (!confirm(`Drop table \`${db}\`.\`${table}\`? This cannot be undone.`)) return;

    try {
      await mysqlQuery(connectionId, `DROP TABLE \`${db}\`.\`${table}\``);
      setTablesByDb((prev) => ({
        ...prev,
        [db]: (prev[db] ?? []).filter((t) => t !== table)
      }));
      if (selectedTableInfo?.database === db && selectedTableInfo?.table === table) {
        setSelectedTable(undefined);
        setSelectedTableInfo(null);
        setDataState(defaultDataState);
      }
      const targetKey = getMysqlOpenedTableKey(db, table);
      const remainingOpenedTables = openedTables.filter((item) => getMysqlOpenedTableKey(item.database, item.table) !== targetKey);
      setOpenedTables(remainingOpenedTables);
      if (activeOpenedTableKey === targetKey) {
        const nextActive = remainingOpenedTables[remainingOpenedTables.length - 1] ?? null;
        setActiveOpenedTableKey(nextActive ? getMysqlOpenedTableKey(nextActive.database, nextActive.table) : null);
        if (location.pathname === "/mysql/table") {
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

  const handleTruncateTable = async (db: string, table: string) => {
    if (!connectionId) return;
    if (!confirm(`Truncate table \`${db}\`.\`${table}\`? All data will be deleted.`)) return;

    try {
      await mysqlQuery(connectionId, `TRUNCATE TABLE \`${db}\`.\`${table}\``);
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

  const handleCopyTable = async (db: string, table: string) => {
    if (!connectionId) return;

    const nextName = window.prompt(t("mysql.tableManager.copyTablePrompt"), `${table}_copy`)?.trim();
    if (!nextName || nextName === table) return;

    try {
      await mysqlQuery(connectionId, `CREATE TABLE \`${db}\`.\`${nextName}\` LIKE \`${db}\`.\`${table}\``);
      await mysqlQuery(connectionId, `INSERT INTO \`${db}\`.\`${nextName}\` SELECT * FROM \`${db}\`.\`${table}\``);
      await refreshTablesForDb(db);
    } catch (err) {
      logError(err, {
        source: "mysqlTableManager.copyTable",
        message: `Failed to copy table ${db}.${table} to ${nextName}`
      });
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // ─── Context menu ───

  const handleTableContextMenu = (e: MouseEvent, db: string, table: string) => {
    e.preventDefault();
    e.stopPropagation();
    handleSelectTable(db, table);

    const currentSelectedTables = selectedOverviewTablesRef.current;
    const nextSelectedTables = currentSelectedTables.includes(table)
      ? getOrderedSelectedTables(db, currentSelectedTables)
      : [table];

    if (!currentSelectedTables.includes(table)) {
      setSelectedOverviewTables([table]);
      selectedOverviewTablesRef.current = [table];
      setOverviewSelectionAnchor(table);
    }

    setTreeContextMenu({ db, table, selectedTables: nextSelectedTables, x: e.clientX, y: e.clientY });
  };

  const handleRowContextMenu = (e: MouseEvent<HTMLElement>, rowIndex: number, column: string, value: unknown) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedRowIndex(rowIndex);
    const columnIndex = dataState.columns.indexOf(column);
    const selectedCell = createSelectedCell(rowIndex, columnIndex);
    if (selectedCell.column && !selectedCellKeySet.has(selectedCell.key)) {
      setSelectedCells([selectedCell]);
      setSelectionAnchor({ rowIndex, columnIndex });
    }
    setRowContextMenu({ x: e.clientX, y: e.clientY, rowIndex, columnIndex, column, value });
  };


  useEffect(() => {
    setSelectedCells([]);
    setSelectionAnchor(null);
  }, [activeOpenedTableKey, dataState.columns, dataState.page, dataState.pageSize, dataState.rows]);

  // Close context menu on outside click / scroll / resize
  useEffect(() => {
    if (!databaseContextMenu && !treeContextMenu && !rowContextMenu && !columnHeaderContextMenu) return;
    const close = () => {
      setDatabaseContextMenu(null);
      setTreeContextMenu(null);
      setRowContextMenu(null);
      setColumnHeaderContextMenu(null);
    };
    window.addEventListener("click", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [columnHeaderContextMenu, databaseContextMenu, rowContextMenu, treeContextMenu]);

  const handleExportTableSql = async (database: string, table: string, includeData: boolean) => {
    if (!connectionId) return;
    try {
      const message = await mysqlExportTable(connectionId, database, table, includeData);
      if (message) {
        setExportSuccessMessage(message);
      }
    } catch (err) {
      logError(err, {
        source: "mysqlTableManager.exportTable",
        message: `Failed to export table ${database}.${table}`
      });
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTreeContextMenu(null);
    }
  };

  const handleExportSelectedTablesSql = async (database: string, tables: string[], includeData: boolean) => {
    if (!connectionId || tables.length === 0) return false;
    try {
      const message = await mysqlExportTables(connectionId, database, tables, includeData);
      if (message) {
        setExportSuccessMessage(message);
      }
      return true;
    } catch (err) {
      logError(err, {
        source: "mysqlTableManager.exportSelectedTables",
        message: `Failed to export selected tables from ${database}`
      });
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setTreeContextMenu(null);
    }
  };

  const handleAddColumn = useCallback(() => {
    const newId = Date.now().toString();
    setEditingRows([...editingRows, {
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
  }, [editingRows]);

  const handleDeleteColumn = useCallback((columnId: string) => {
    if (!createTableModal) return;

    setCreateTableModal({
      ...createTableModal,
      columns: createTableModal.columns.filter(col => col.id !== columnId)
    });
  }, [createTableModal]);


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

    // 汇总编辑行数据 - 过滤掉没有列名的行
    const editingColumnsToAdd = editingRows
      .filter(row => row.name.trim()) // 只保留有列名的行
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
      } as any));

    // 合并已有列和编辑行中有效的列
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

    // 生成建表SQL（使用汇总后的列）
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
      await mysqlQuery(connectionId, sql);

      // Refresh the database tables to show new table
      if (database) {
        const newTables = await mysqlListTables(connectionId, database);
        if (newTables) {
          setTablesByDb(prev => ({
            ...prev,
            [database]: newTables
          }));
        }
      }

      setCreateTableSuccess(tableName);
      setCreateTableModal(null);
      setSelectedEditingRowId(null);
      setEditingRows([{
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
      }]);
    } catch (err) {
      logError(err, {
        source: "mysqlTableManager.createTable",
        message: `Failed to create table ${tableName}`
      });
      setCreateTableError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreateTableLoading(false);
    }
  }, [createTableModal, connectionId, editingRows, generateCreateTableSQL, tablesByDb, t]);

  const openExportSelectionModal = useCallback((database: string, tables: string[], includeData: boolean) => {
    const availableTables = tablesByDb[database] ?? [];
    const orderedTables = getOrderedSelectedTables(database, tables);
    const initialSelection = orderedTables.length > 0
      ? orderedTables
      : availableTables.length > 0
        ? [availableTables[0]]
        : [];

    setExportSelectionModal({
      database,
      availableTables,
      selectedTables: initialSelection,
      includeData,
    });
    setTreeContextMenu(null);
  }, [getOrderedSelectedTables, tablesByDb]);

  const handleToggleExportSelectionTable = useCallback((table: string) => {
    setExportSelectionModal((previous) => {
      if (!previous) return previous;
      const selectedTables = previous.selectedTables.includes(table)
        ? previous.selectedTables.filter((item) => item !== table)
        : getOrderedSelectedTables(previous.database, [...previous.selectedTables, table]);
      return { ...previous, selectedTables };
    });
  }, [getOrderedSelectedTables]);

  const handleConfirmExportSelection = async () => {
    if (!exportSelectionModal) return;
    const success = await handleExportSelectedTablesSql(
      exportSelectionModal.database,
      exportSelectionModal.selectedTables,
      exportSelectionModal.includeData,
    );
    if (success) {
      setExportSelectionModal(null);
    }
  };

  const handleImportTableSql = async (database: string, table: string) => {
    if (!connectionId) return;
    try {
      const message = await mysqlImportSql(connectionId, database, table);
      await refreshTablesForDb(database);
      if (selectedTableInfo?.database === database && selectedTableInfo.table === table) {
        await handleOpenTable(database, table, rightPanelTab);
      }
      if (message) {
        window.alert(message);
      }
    } catch (err) {
      logError(err, {
        source: "mysqlTableManager.importTable",
        message: `Failed to import SQL into table ${database}.${table}`
      });
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTreeContextMenu(null);
    }
  };

  // ─── SQL modal ───

  // Keep this function for backward compatibility (may be used elsewhere)
  // @ts-ignore - used by other modules
  const _openSqlModal = (prefill?: string) => {
    setSqlModalValue(prefill ?? "");
    setSqlModalResult("");
    setSqlModalOpen(true);
  };

  const executeSqlModal = async () => {
    if (!connectionId || !sqlModalValue.trim()) return;
    setSqlModalLoading(true);
    setSqlModalResult("");

    try {
      const res = await mysqlQuery(connectionId, sqlModalValue.trim());
      if (res.isResultSet) {
        setSqlModalResult(`Result: ${res.rows.length} rows returned`);
      } else {
        setSqlModalResult(`Done. Affected rows: ${res.affectedRows}`);
      }
      refreshDatabases();
      if (selectedDatabase) {
        refreshTablesForDb(selectedDatabase);
      }
    } catch (err) {
      logError(err, {
        source: "mysqlTableManager.sqlModal",
        message: "Failed to execute SQL from MySQL table manager modal"
      });
      setSqlModalResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSqlModalLoading(false);
    }
  };

  const openAddColumnModal = () => {
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
  };

  const openEditColumnModal = (column: ColumnMeta) => {
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
  };

  const buildDefaultClause = (value: string) => {
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
  };

  const refreshSelectedTableInfo = async () => {
    if (!selectedTableInfo) return;
    await handleOpenTable(selectedTableInfo.database, selectedTableInfo.table, rightPanelTab);
  };

  const handleSaveColumnEdit = async () => {
    if (!connectionId || !selectedTableInfo) return;

    const field = columnEditForm.field.trim();
    const type = buildColumnType(columnEditForm).trim();
    let extra = columnEditForm.extra.trim();

    // Handle auto_increment
    if (columnEditForm.autoIncrement) {
      if (!extra.toUpperCase().includes("AUTO_INCREMENT")) {
        extra = extra ? `${extra} AUTO_INCREMENT` : "AUTO_INCREMENT";
      }
    } else {
      // Remove AUTO_INCREMENT if unchecked
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
      await mysqlQuery(connectionId, sql);
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
  };

  const buildColumnDefinitionFromMeta = (column: ColumnMeta) => {
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
  };

  const handleMoveColumn = async (column: ColumnMeta, direction: "up" | "down") => {
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
      await mysqlQuery(connectionId, sql);
      await refreshSelectedTableInfo();
    } catch (err) {
      logError(err, {
        source: "mysqlTableManager.moveColumn",
        message: `Failed to move column ${column.field} ${direction}`
      });
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDropColumn = async (column: ColumnMeta) => {
    if (!connectionId || !selectedTableInfo) return;
    if (!confirm(`Drop column \`${column.field}\` from \`${selectedTableInfo.database}\`.\`${selectedTableInfo.table}\`?`)) return;

    try {
      await mysqlQuery(
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

  // ─── Render ───

  if (!activeMysqlConnection) {
    return (
      <div className="page">
        <div className="card workspace-empty-card">
          <span className="muted">{t("mysql.query.noMysqlConnection")}</span>
        </div>
      </div>
    );
  }

  const renderStructureTab = () => {
    return (
      <StructureTabPanel
        selectedTableInfo={selectedTableInfo}
        onAddColumn={openAddColumnModal}
        onManageIndexes={openIndexModal}
        onMoveColumn={(col, dir) => void handleMoveColumn(col, dir)}
        onEditColumn={openEditColumnModal}
        onDropColumn={handleDropColumn}
      />
    );
  };

  const renderDataTab = () => {
    return (
      <DataTabPanel
        selectedTableInfo={selectedTableInfo}
        dataState={dataState}
        visibleDataColumns={visibleDataColumns}
        selectedCells={selectedCells}
        selectedCellKeySet={selectedCellKeySet}
        expandedRow={expandedRow}
        selectedRowIndex={selectedRowIndex}
        filterPanelOpen={filterPanelOpen}
        filterDraftTree={filterDraftTree}
        columnMenuOpen={columnMenuOpen}
        activeFilterTree={activeFilterTree}
        totalPages={totalPages}
        filterOperators={filterOperators}
        setSelectedCells={setSelectedCells}
        setFilterPanelOpen={setFilterPanelOpen}
        setFilterDraftTree={setFilterDraftTree}
        setColumnMenuOpen={setColumnMenuOpen}
        setExpandedRow={setExpandedRow}
        setSelectedRowIndex={setSelectedRowIndex}
        onAddNewRow={handleAddNewRow}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        onCellClick={handleCellClick}
        onRowContextMenu={handleRowContextMenu}
        onEditRow={handleEditRow}
        onDeleteRow={handleDeleteRow}
        onClearFilter={() => void clearFilter()}
        onClearSort={() => void clearSort()}
        onApplyFilter={(tree) => void applyFilter(tree)}
        onVisibleColumnToggle={handleVisibleColumnToggle}
        onSelectAllVisibleColumns={handleSelectAllVisibleColumns}
        onFetchData={fetchData}
        onBatchEditSelectedCells={openBatchEditModal}
        onOpenSortModal={() => {
          setSortDraft({
            column: activeOpenedTable?.sortColumn ?? dataState.columns[0] ?? "",
            direction: activeOpenedTable?.sortDirection ?? "asc"
          });
          setSortModalOpen(true);
        }}
      />
    );
  };

  const renderInfoTab = () => {
    return <InfoTabPanel selectedTableInfo={selectedTableInfo} />;
  };

  const renderDatabaseOverview = () => {
    const tables = tablesByDb[expandedDatabase ?? ""] ?? [];

    return (
      <DatabaseOverviewPanel
        expandedDatabase={expandedDatabase ?? null}
        tables={tables}
        selectedTable={selectedTable}
        selectedOverviewTables={selectedOverviewTables}
        loading={loading}
        onTableClick={handleOverviewTableClick}
        onBrowseTable={handleBrowseData}
        onTableContextMenu={handleTableContextMenu}
        onRefreshTables={refreshTablesForDb}
        onCreateTableClick={(modalState, editingRows) => {
          setCreateTableModal(modalState);
          setCreateTableError("");
          setSelectedEditingRowId(null);
          setEditingRows(editingRows);
        }}
      />
    );
  };

  const renderTableWorkspace = () => {
    if (!activeOpenedTable) {
      return (
        <div className="workspace-center-state">
          <span className="muted">{t("mysql.tableManager.selectTableHint")}</span>
        </div>
      );
    }

    return (
      <>
        <div className="card-header page-section-header">
          <div>
            <h3 className="card-title card-title-reset">
              {selectedTableInfo?.database ?? activeOpenedTable.database}.{selectedTableInfo?.table ?? activeOpenedTable.table}({selectedTableInfo?.rowCount ?? 0} {t("mysql.data.rowCount")})
            </h3>
          </div>
        </div>

        <div className="tm-tab-strip">
          <button
            className={`btn btn-sm tm-tab-button ${rightPanelTab === "data" ? "btn-primary is-active" : "btn-ghost"}`}
            onClick={() => {
              if (!activeOpenedTable) return;
              setRightPanelTab("data");
              setOpenedTableView(activeOpenedTable.database, activeOpenedTable.table, "data");
            }}
          >
            {t("mysql.tableManager.data")}
          </button>
          <button
            className={`btn btn-sm tm-tab-button ${rightPanelTab === "structure" ? "btn-primary is-active" : "btn-ghost"}`}
            onClick={() => {
              if (!activeOpenedTable) return;
              setRightPanelTab("structure");
              setOpenedTableView(activeOpenedTable.database, activeOpenedTable.table, "structure");
            }}
          >
            {t("mysql.tableManager.structure")}
          </button>
          <button
            className={`btn btn-sm tm-tab-button ${rightPanelTab === "info" ? "btn-primary is-active" : "btn-ghost"}`}
            onClick={() => {
              if (!activeOpenedTable) return;
              setRightPanelTab("info");
              setOpenedTableView(activeOpenedTable.database, activeOpenedTable.table, "info");
            }}
          >
            {t("mysql.tableManager.info")}
          </button>
        </div>

        <div className="tm-tab-panel">
          {rightPanelTab === "data"
            ? renderDataTab()
            : rightPanelTab === "info"
              ? renderInfoTab()
              : renderStructureTab()}
        </div>
      </>
    );
  };

  return (
    <div className="page">
      <div className="tm-shell">
        <div className="card tm-main-card">
          {isTableWorkspace ? renderTableWorkspace() : renderDatabaseOverview()}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-danger tm-error-banner">
          {error}
          <button className="btn btn-sm btn-ghost" onClick={() => setError("")}>{t("common.close")}</button>
        </div>
      )}

      {/* Tree context menu */}
      {treeContextMenu && (
        <div
          className="context-menu-panel"
          style={{
            position: "fixed",
            left: `${treeContextMenu.x}px`,
            top: `${treeContextMenu.y}px`,
            minWidth: "140px"
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {treeContextMenu.selectedTables.length <= 1 ? (
            <>
              <button
                type="button"
                className="btn btn-sm btn-ghost context-menu-button"
                onClick={() => {
                  const { db, table } = treeContextMenu;
                  setTreeContextMenu(null);
                  void handleBrowseData(db, table);
                }}
              >
                {t("mysql.tableManager.openTable")}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost context-menu-button"
                onClick={() => {
                  const { db, table } = treeContextMenu;
                  setTreeContextMenu(null);
                  void handleDesignTable(db, table);
                }}
              >
                {t("mysql.tableManager.designTable")}
              </button>
              <div className="context-menu-separator" />
              <button
                type="button"
                className="btn btn-sm btn-ghost context-menu-button"
                onClick={() => {
                  const { db, table } = treeContextMenu;
                  void handleImportTableSql(db, table);
                }}
              >
                {t("mysql.tableManager.importSql")}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost context-menu-button"
                onClick={() => {
                  const { db, table } = treeContextMenu;
                  void handleExportTableSql(db, table, false);
                }}
              >
                {t("mysql.tableManager.exportStructure")}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost context-menu-button"
                onClick={() => {
                  const { db, table } = treeContextMenu;
                  void handleExportTableSql(db, table, true);
                }}
              >
                {t("mysql.tableManager.exportStructureAndData")}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost context-menu-button"
                onClick={() => {
                  const { db, table } = treeContextMenu;
                  openExportSelectionModal(db, [table], false);
                }}
              >
                {t("mysql.tableManager.exportSelectedTables")}
              </button>
              <div className="context-menu-separator" />
              <button
                type="button"
                className="btn btn-sm btn-ghost context-menu-button"
                onClick={() => {
                  const { db, table } = treeContextMenu;
                  setTreeContextMenu(null);
                  void handleCopyTable(db, table);
                }}
              >
                {t("mysql.tableManager.copyTable")}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost context-menu-button"
                onClick={() => {
                  const { db, table } = treeContextMenu;
                  setTreeContextMenu(null);
                  void handleTruncateTable(db, table);
                }}
              >
                {t("mysql.tableManager.truncate")}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost text-danger context-menu-button"
                onClick={() => {
                  const { db, table } = treeContextMenu;
                  setTreeContextMenu(null);
                  void handleDropTable(db, table);
                }}
              >
                {t("mysql.tableManager.dropTable")}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-sm btn-ghost context-menu-button"
                onClick={() => {
                  const { db, selectedTables } = treeContextMenu;
                  openExportSelectionModal(db, selectedTables, false);
                }}
              >
                {t("mysql.tableManager.exportSelectedTables")}
              </button>
            </>
          )}
        </div>
      )}

      {exportSelectionModal && (
        <div className="modal-overlay" onClick={() => setExportSelectionModal(null)}>
          <div className="card modal-card modal-card-md modal-card-scroll" onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <div>
                <h3 className="card-title">{t("mysql.tableManager.exportSelectedTables")}</h3>
                <p className="muted tm-modal-note">
                  {t("mysql.tableManager.exportSelectionSummary", {
                    database: exportSelectionModal.database,
                    count: exportSelectionModal.selectedTables.length,
                  })}
                </p>
              </div>
            </div>
            <div className="modal-card-body modal-card-body-scroll tm-export-selection-modal-body">
              <div className="tm-export-selection-toolbar">
                <div className="tm-toolbar-actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => setExportSelectionModal((previous) => previous ? {
                      ...previous,
                      selectedTables: previous.availableTables,
                    } : previous)}
                  >
                    {t("mysql.tableManager.selectAllTables")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => setExportSelectionModal((previous) => previous ? {
                      ...previous,
                      selectedTables: [],
                    } : previous)}
                  >
                    {t("mysql.tableManager.clearSelection")}
                  </button>
                </div>
                <label className="tm-checkbox-label">
                  <input
                    type="checkbox"
                    checked={exportSelectionModal.includeData}
                    onChange={(event) => setExportSelectionModal((previous) => previous ? {
                      ...previous,
                      includeData: event.target.checked,
                    } : previous)}
                  />
                  <span>{t("mysql.tableManager.includeTableData")}</span>
                </label>
              </div>

              <div className="tm-export-selection-list">
                {exportSelectionModal.availableTables.map((table) => {
                  const checked = exportSelectionModal.selectedTables.includes(table);
                  return (
                    <label key={table} className={`tm-export-selection-item ${checked ? "is-selected" : ""}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleExportSelectionTable(table)}
                      />
                      <span>{table}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="modal-card-footer">
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setExportSelectionModal(null)}>
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={exportSelectionModal.selectedTables.length === 0}
                onClick={() => void handleConfirmExportSelection()}
              >
                {t("mysql.tableManager.confirmExportSelectedTables")}
              </button>
            </div>
          </div>
        </div>
      )}

      {rowContextMenu && (
        <div
          className="context-menu-panel"
          style={{
            position: "fixed",
            left: `${rowContextMenu.x}px`,
            top: `${rowContextMenu.y}px`,
            minWidth: "180px"
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="btn btn-sm btn-ghost context-menu-button"
            onClick={() => {
              void copyToClipboard(rowContextMenu.value === null ? "NULL" : String(rowContextMenu.value));
              setRowContextMenu(null);
            }}
          >
            {t("mysql.tableManager.copyCellValue")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost context-menu-button"
            onClick={() => {
              void copyToClipboard(formatSqlValue(rowContextMenu.value));
              setRowContextMenu(null);
            }}
          >
            {t("mysql.tableManager.copySqlValue")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost context-menu-button"
            onClick={() => {
              void copyToClipboard(JSON.stringify(getRowObject(rowContextMenu.rowIndex), null, 2));
              setRowContextMenu(null);
            }}
          >
            {t("dataBrowser.copyRow")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost context-menu-button"
            onClick={() => {
              void copyToClipboard(buildInsertSql(rowContextMenu.rowIndex));
              setRowContextMenu(null);
            }}
          >
            {t("mysql.tableManager.copyInsert")}
          </button>
          <div className="context-menu-separator" />
          <button
            type="button"
            className="btn btn-sm btn-ghost context-menu-button"
            onClick={() => {
              void applyFilter(appendConditionToRootTree(
                activeFilterTree,
                createFilterCondition(
                  rowContextMenu.column,
                  rowContextMenu.value === null ? "isNull" : typeof rowContextMenu.value === "string" && rowContextMenu.value === "" ? "emptyString" : "eq",
                  rowContextMenu.value === null ? "" : String(rowContextMenu.value)
                )
              ));
              setRowContextMenu(null);
            }}
          >
            {t("mysql.tableManager.filterByCurrentValue")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost context-menu-button"
            onClick={() => {
              void applySort(rowContextMenu.column, "asc");
              setRowContextMenu(null);
            }}
          >
            {t("dataBrowser.sortAscending")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost context-menu-button"
            onClick={() => {
              void applySort(rowContextMenu.column, "desc");
              setRowContextMenu(null);
            }}
          >
            {t("dataBrowser.sortDescending")}
          </button>
          <div className="context-menu-separator" />
          <button
            type="button"
            className="btn btn-sm btn-ghost context-menu-button"
            onClick={() => {
              void applyValueToCells(getContextTargetCells(rowContextMenu), "");
              setRowContextMenu(null);
            }}
          >
            {t("mysql.tableManager.setEmptyString")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost context-menu-button"
            onClick={() => {
              void applyValueToCells(getContextTargetCells(rowContextMenu), null);
              setRowContextMenu(null);
            }}
          >
            {t("mysql.tableManager.setNull")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost context-menu-button"
            onClick={() => {
              handleEditCell(rowContextMenu.rowIndex, rowContextMenu.column, rowContextMenu.value);
              setRowContextMenu(null);
            }}
          >
            {t("mysql.tableManager.editCell")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost context-menu-button"
            onClick={() => {
              const targetCells = getContextTargetCells(rowContextMenu);
              setSelectedCells(targetCells);
              openBatchEditModal(targetCells);
              setRowContextMenu(null);
            }}
          >
            {t("mysql.tableManager.batchEditSelectedCells")}
          </button>
          <div className="context-menu-separator" />
          <button
            type="button"
            className="btn btn-sm btn-ghost context-menu-button text-danger"
            onClick={() => {
              void handleDeleteRow(rowContextMenu.rowIndex);
              setRowContextMenu(null);
            }}
          >
            {t("common.delete")}
          </button>
        </div>
      )}

      {columnHeaderContextMenu && (
        <div
          className="context-menu-panel"
          style={{
            position: "fixed",
            left: `${columnHeaderContextMenu.x}px`,
            top: `${columnHeaderContextMenu.y}px`,
            minWidth: "180px"
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="btn btn-sm btn-ghost context-menu-button"
            onClick={() => {
              void applySort(columnHeaderContextMenu.column, "asc");
              setColumnHeaderContextMenu(null);
            }}
          >
            {t("dataBrowser.sortAscending")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost context-menu-button"
            onClick={() => {
              void applySort(columnHeaderContextMenu.column, "desc");
              setColumnHeaderContextMenu(null);
            }}
          >
            {t("dataBrowser.sortDescending")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost context-menu-button"
            onClick={() => {
              void clearSort();
              setColumnHeaderContextMenu(null);
            }}
          >
            {t("mysql.tableManager.clearSort")}
          </button>
        </div>
      )}

      {sortModalOpen && (
        <div className="modal-overlay">
          <div className="card modal-card modal-card-sm">
            <div className="card-header page-section-header">
              <h3 className="card-title">{t("mysql.tableManager.sortData")}</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setSortModalOpen(false)}>{t("common.close")}</button>
            </div>
            <div className="modal-card-body modal-card-grid">
              <div>
                <label>{t("mysql.tableManager.sortColumn")}</label>
                <select className="form-control" value={sortDraft.column} onChange={(event) => setSortDraft((prev) => ({ ...prev, column: event.target.value }))}>
                  {dataState.columns.map((column) => (
                    <option key={column} value={column}>{column}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>{t("mysql.tableManager.sortDirection")}</label>
                <select className="form-control" value={sortDraft.direction} onChange={(event) => setSortDraft((prev) => ({ ...prev, direction: event.target.value as "asc" | "desc" }))}>
                  <option value="asc">{t("dataBrowser.sortAscending")}</option>
                  <option value="desc">{t("dataBrowser.sortDescending")}</option>
                </select>
              </div>
            </div>
            <div className="modal-card-footer">
              <button className="btn btn-sm btn-ghost" onClick={() => void clearSort()}>{t("mysql.tableManager.clearSort")}</button>
              <button className="btn btn-sm btn-ghost" onClick={() => setSortModalOpen(false)}>{t("common.cancel")}</button>
              <button className="btn btn-sm btn-primary" onClick={() => void applySort(sortDraft.column, sortDraft.direction)}>{t("common.save")}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit row modal */}
      {editingRow && (
        <div className="modal-overlay">
          <div className="card modal-card modal-card-xl modal-card-scroll">
            <div className="card-header page-section-header">
              <h3 className="card-title">{t("dataBrowser.editDocument")}</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setEditingRow(null)}>{t("common.close")}</button>
            </div>
            <div className="modal-card-body modal-card-body-scroll">
              <textarea
                className="json-editor json-editor-lg"
                value={editingRow.json}
                onChange={(e) => setEditingRow({ ...editingRow, json: e.target.value })}
              />
              {editError && <div className="text-danger modal-inline-error">{editError}</div>}
            </div>
            <div className="modal-card-footer">
              <button className="btn btn-sm btn-ghost" onClick={() => setEditingRow(null)}>{t("common.cancel")}</button>
              <button className="btn btn-sm btn-primary" onClick={handleSaveEdit}>{t("common.save")}</button>
            </div>
          </div>
        </div>
      )}

      {editingCell && (
        <div className="modal-overlay">
          <div className="card modal-card modal-card-md modal-card-scroll">
            <div className="card-header page-section-header">
              <h3 className="card-title">{t("mysql.tableManager.cellEditorTitle", { column: editingCell.column })}</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setEditingCell(null)}>{t("common.close")}</button>
            </div>
            <div className="modal-card-body modal-card-body-scroll tm-compact-grid">
              <label>{t("mysql.tableManager.cellValue")}</label>
              <textarea
                className="json-editor json-editor-md"
                value={editingCell.value}
                onChange={(event) => setEditingCell((prev) => prev ? { ...prev, value: event.target.value } : prev)}
              />
              {editError && <div className="text-danger">{editError}</div>}
            </div>
            <div className="modal-card-footer">
              <button className="btn btn-sm btn-ghost" onClick={() => setEditingCell(null)}>{t("common.cancel")}</button>
              <button className="btn btn-sm btn-primary" onClick={() => void handleSaveCellEdit()}>{t("common.save")}</button>
            </div>
          </div>
        </div>
      )}

      <BatchEditModal
        isOpen={batchEditOpen}
        selectedCellsCount={selectedCells.length}
        batchEditMode={batchEditDraft.mode}
        batchEditValue={batchEditDraft.value}
        batchEditError={batchEditError}
        onModeChange={(mode) => setBatchEditDraft((prev) => ({ ...prev, mode }))}
        onValueChange={(value) => setBatchEditDraft((prev) => ({ ...prev, value }))}
        onClose={() => setBatchEditOpen(false)}
        onSave={() => void handleSaveBatchEdit()}
      />

      {/* Column edit modal */}
      {columnEditOpen && (
        <div className="modal-overlay">
          <div className="card modal-card modal-card-lg modal-card-scroll">
            <div className="card-header page-section-header">
              <h3 className="card-title">
                {columnEditMode === "add" ? t("mysql.tableManager.addColumn") : t("mysql.tableManager.editStructure")}
              </h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setColumnEditOpen(false)}>{t("common.close")}</button>
            </div>
            <div className="modal-card-body modal-card-grid-2">
              <div>
                <label>{t("mysql.tableManager.columnName")}</label>
                <input
                  className="form-control"
                  value={columnEditForm.field}
                  disabled={columnEditMode === "edit" && Boolean(columnEditOriginalField)}
                  onChange={(event) => setColumnEditForm((prev) => ({ ...prev, field: event.target.value }))}
                />
              </div>
              <div>
                <label>{t("mysql.tableManager.columnType")}</label>
                <div className="tm-compact-grid">
                  <select
                    className="form-control"
                    value={columnEditForm.typeName}
                    onChange={(event) => {
                      const nextTypeName = event.target.value;
                      const option = getColumnTypeOption(nextTypeName);
                      setColumnEditForm((prev) => ({
                        ...prev,
                        typeName: nextTypeName,
                        length: option?.lengthMode === "none" ? "" : prev.length,
                        scale: option?.lengthMode === "pair" ? prev.scale : "",
                        unsigned: option?.supportsUnsigned ? prev.unsigned : false,
                        customType: nextTypeName === "custom" ? prev.customType : ""
                      }));
                    }}
                  >
                    {mysqlColumnTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  {columnEditForm.typeName === "custom" ? (
                    <input
                      className="form-control"
                      value={columnEditForm.customType}
                      onChange={(event) => setColumnEditForm((prev) => ({ ...prev, customType: event.target.value }))}
                      placeholder="varchar(255) / enum('a','b')"
                    />
                  ) : (
                    <div className="tm-compact-grid-2">
                      <input
                        className="form-control"
                        value={columnEditForm.length}
                        disabled={getColumnTypeOption(columnEditForm.typeName)?.lengthMode === "none"}
                        onChange={(event) => setColumnEditForm((prev) => ({ ...prev, length: event.target.value.replace(/[^0-9]/g, "") }))}
                        placeholder={t("mysql.tableManager.typeLength")}
                      />
                      <input
                        className="form-control"
                        value={columnEditForm.scale}
                        disabled={getColumnTypeOption(columnEditForm.typeName)?.lengthMode !== "pair"}
                        onChange={(event) => setColumnEditForm((prev) => ({ ...prev, scale: event.target.value.replace(/[^0-9]/g, "") }))}
                        placeholder={t("mysql.tableManager.typeScale")}
                      />
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label>{t("mysql.tableManager.defaultValue")}</label>
                <input
                  className="form-control"
                  value={columnEditForm.defaultValue}
                  onChange={(event) => setColumnEditForm((prev) => ({ ...prev, defaultValue: event.target.value }))}
                  placeholder="NULL / CURRENT_TIMESTAMP / text"
                />
              </div>
              <div>
                <label>{t("mysql.tableManager.extra")}</label>
                <input
                  className="form-control"
                  value={columnEditForm.extra}
                  onChange={(event) => setColumnEditForm((prev) => ({ ...prev, extra: event.target.value }))}
                  placeholder="AUTO_INCREMENT"
                />
              </div>
              <div className="tm-inline-checkbox">
                <input
                  id="column-nullable"
                  type="checkbox"
                  checked={columnEditForm.nullable}
                  onChange={(event) => setColumnEditForm((prev) => ({ ...prev, nullable: event.target.checked }))}
                />
                <label htmlFor="column-nullable">{t("mysql.tableManager.nullable")}</label>
              </div>
              <div className="tm-inline-checkbox">
                <input
                  id="column-unsigned"
                  type="checkbox"
                  checked={columnEditForm.unsigned}
                  disabled={!getColumnTypeOption(columnEditForm.typeName)?.supportsUnsigned || columnEditForm.typeName === "custom"}
                  onChange={(event) => setColumnEditForm((prev) => ({ ...prev, unsigned: event.target.checked }))}
                />
                <label htmlFor="column-unsigned">{t("mysql.tableManager.unsigned")}</label>
              </div>
              <div className="tm-inline-checkbox">
                <input
                  id="column-auto-increment"
                  type="checkbox"
                  checked={columnEditForm.autoIncrement}
                  onChange={(event) => setColumnEditForm((prev) => ({ ...prev, autoIncrement: event.target.checked }))}
                />
                <label htmlFor="column-auto-increment">{t("mysql.tableManager.autoIncrement")}</label>
              </div>
            </div>
            {columnEditError && (
              <div className="text-danger modal-card-error">{columnEditError}</div>
            )}
            <div className="modal-card-footer">
              <button className="btn btn-sm btn-ghost" onClick={() => setColumnEditOpen(false)}>{t("common.cancel")}</button>
              <button className="btn btn-sm btn-primary" onClick={handleSaveColumnEdit} disabled={columnEditLoading}>
                {columnEditLoading ? t("common.loading") : t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Index management modal */}
      {indexModalOpen && (
        <div className="modal-overlay">
          <div className="card modal-card modal-card-lg modal-card-scroll">
            <div className="card-header page-section-header">
              <h3 className="card-title">
                {indexModalMode === "view" ? t("mysql.tableManager.indexManagement") : indexModalMode === "create" ? t("mysql.tableManager.createNewIndex") : t("mysql.tableManager.editIndex")}
              </h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setIndexModalOpen(false)}>{t("common.close")}</button>
            </div>

            <div className="modal-card-body modal-card-grid">
              {indexModalMode === "view" ? (
                <>
                  <div className="flex-gap">
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={openCreateIndexModal}
                      disabled={!selectedTableInfo?.columns || selectedTableInfo.columns.length === 0}
                    >
                      + {t("mysql.tableManager.createIndex")}
                    </button>
                  </div>

                  {indexError && <div className="text-danger">{indexError}</div>}

                  {indexLoading ? (
                    <div className="muted">{t("common.loading")}</div>
                  ) : indexes.filter(idx => !idx.primary).length === 0 ? (
                    <div className="muted">{t("common.noData")}</div>
                  ) : (
                    <div className="table-wrapper">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th>{t("mysql.tableManager.indexName")}</th>
                            <th>{t("dataBrowser.field")}</th>
                            <th>{t("mysql.tableManager.indexType")}</th>
                            <th>{t("mysql.tableManager.uniqueIndex")}</th>
                            <th className="tm-table-head-actions">{t("dataBrowser.actions")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {indexes.filter(idx => !idx.primary).map((idx) => (
                            <tr key={idx.name}>
                              <td><strong>{idx.name}</strong></td>
                              <td>{idx.columns.join(", ")}</td>
                              <td>{idx.indexType}</td>
                              <td>{idx.unique ? "✓" : "-"}</td>
                              <td className="tm-actions-cell">
                                <button
                                  className="btn btn-sm btn-ghost"
                                  onClick={() => openEditIndexModal(idx)}
                                  disabled={indexLoading}
                                >
                                  {t("common.edit")}
                                </button>
                                <button
                                  className="btn btn-sm btn-ghost text-danger"
                                  onClick={() => handleDropIndex(idx.name)}
                                  disabled={indexLoading}
                                >
                                  {t("common.delete")}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label>{t("mysql.tableManager.indexName")} *</label>
                    <input
                      className="form-control"
                      value={indexFormData.name}
                      onChange={(e) => setIndexFormData((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. idx_email"
                      disabled={indexModalMode === "edit"}
                    />
                  </div>

                  <div>
                    <label>{t("mysql.tableManager.selectColumns")} *</label>
                    <div className="tm-index-columns">
                      {selectedTableInfo?.columns?.map((col) => (
                        <label key={col.field} className="tm-checkbox-label">
                          <input
                            type="checkbox"
                            checked={indexFormData.columns.includes(col.field)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setIndexFormData((prev) => ({
                                  ...prev,
                                  columns: [...prev.columns, col.field]
                                }));
                              } else {
                                setIndexFormData((prev) => ({
                                  ...prev,
                                  columns: prev.columns.filter((c) => c !== col.field)
                                }));
                              }
                            }}
                          />
                          <span>{col.field}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label>
                      <input
                        type="checkbox"
                        checked={indexFormData.unique}
                        onChange={(e) => setIndexFormData((prev) => ({ ...prev, unique: e.target.checked }))}
                      />
                      {t("mysql.tableManager.uniqueIndex")}
                    </label>
                  </div>

                  <div>
                    <label>{t("mysql.tableManager.indexType")}</label>
                    <select
                      className="form-control"
                      value={indexFormData.indexType}
                      onChange={(e) => setIndexFormData((prev) => ({ ...prev, indexType: e.target.value }))}
                    >
                      <option value="BTREE">BTREE</option>
                      <option value="HASH">HASH</option>
                    </select>
                  </div>

                  {indexError && <div className="text-danger">{indexError}</div>}
                </>
              )}
            </div>

            <div className="modal-card-footer">
              {indexModalMode === "create" ? (
                <>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      setIndexModalMode("view");
                      setIndexFormData({ name: "", columns: [], unique: false, indexType: "BTREE" });
                    }}
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={handleCreateIndex}
                    disabled={indexLoading || !indexFormData.name || indexFormData.columns.length === 0}
                  >
                    {indexLoading ? t("common.loading") : t("mysql.tableManager.createIndex")}
                  </button>
                </>
              ) : indexModalMode === "edit" ? (
                <>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      setIndexModalMode("view");
                      setIndexFormData({ name: "", columns: [], unique: false, indexType: "BTREE" });
                    }}
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={handleUpdateIndex}
                    disabled={indexLoading || !indexFormData.name || indexFormData.columns.length === 0}
                  >
                    {indexLoading ? t("common.loading") : t("mysql.tableManager.updateIndex")}
                  </button>
                </>
              ) : (
                <button className="btn btn-sm btn-ghost" onClick={() => setIndexModalOpen(false)}>{t("common.close")}</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SQL execution modal */}
      {sqlModalOpen && (
        <div className="modal-overlay">
          <div className="card modal-card modal-card-xl modal-card-scroll">
            <div className="card-header page-section-header">
              <h3 className="card-title">{t("mysql.tableManager.executeSql")}</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setSqlModalOpen(false)}>{t("common.close")}</button>
            </div>
            <div className="modal-card-body modal-card-body-scroll">
              <textarea
                className="json-editor json-editor-sm"
                value={sqlModalValue}
                onChange={(e) => setSqlModalValue(e.target.value)}
                spellCheck={false}
              />
              {sqlModalResult && (
                <div className="tm-sql-result">
                  {sqlModalResult}
                </div>
              )}
            </div>
            <div className="modal-card-footer">
              <button className="btn btn-sm btn-ghost" onClick={() => setSqlModalOpen(false)}>{t("common.cancel")}</button>
              <button className="btn btn-sm btn-primary" onClick={executeSqlModal} disabled={sqlModalLoading}>
                {sqlModalLoading ? t("common.loading") : t("mysql.query.execute")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Table Modal */}
      <CreateTableModal
        isOpen={createTableModal !== null}
        modalState={createTableModal}
        editingRows={editingRows}
        selectedEditingRowId={selectedEditingRowId}
        isLoading={createTableLoading}
        error={createTableError}
        onTableNameChange={(name) => setCreateTableModal((prev) => prev ? { ...prev, tableName: name } : null)}
        onEngineChange={(engine) => setCreateTableModal((prev) => prev ? { ...prev, engine } : null)}
        onCharsetChange={(charset) => setCreateTableModal((prev) => prev ? { ...prev, charset } : null)}
        onColumnNullableChange={(columnId, nullable) => setCreateTableModal((prev) => prev ? { ...prev, columns: prev.columns.map(col => col.id === columnId ? { ...col, nullable } : col) } : null)}
        onColumnPrimaryChange={(columnId, isPrimary) => setCreateTableModal((prev) => prev ? { ...prev, columns: prev.columns.map(col => col.id === columnId ? { ...col, isPrimary } : col) } : null)}
        onColumnAutoIncrementChange={(columnId, autoIncrement) => setCreateTableModal((prev) => prev ? { ...prev, columns: prev.columns.map(col => col.id === columnId ? { ...col, autoIncrement } : col) } : null)}
        onDeleteColumn={(columnId) => handleDeleteColumn(columnId)}
        onSelectEditingRow={(rowId) => setSelectedEditingRowId(rowId)}
        onEditingRowNameChange={(rowId, name) => setEditingRows((prev) => prev.map(r => r.id === rowId ? { ...r, name } : r))}
        onEditingRowTypeChange={(rowId, type) => {
          const typeOption = mysqlColumnTypeOptions.find(opt => opt.value === type);
          setEditingRows((prev) => prev.map(r => r.id === rowId ? {
            ...r,
            type,
            length: typeOption?.lengthMode === "none" ? "" : r.length,
            scale: typeOption?.lengthMode === "pair" ? r.scale : ""
          } : r));
        }}
        onEditingRowLengthChange={(rowId, length) => setEditingRows((prev) => prev.map(r => r.id === rowId ? { ...r, length } : r))}
        onEditingRowScaleChange={(rowId, scale) => setEditingRows((prev) => prev.map(r => r.id === rowId ? { ...r, scale } : r))}
        onEditingRowNullableChange={(rowId, nullable) => setEditingRows((prev) => prev.map(r => r.id === rowId ? { ...r, nullable } : r))}
        onEditingRowPrimaryChange={(rowId, isPrimary) => setEditingRows((prev) => prev.map(r => r.id === rowId ? { ...r, isPrimary } : r))}
        onEditingRowAutoIncrementChange={(rowId, autoIncrement) => setEditingRows((prev) => prev.map(r => r.id === rowId ? { ...r, autoIncrement } : r))}
        onEditingRowDefaultValueChange={(rowId, defaultValue) => setEditingRows((prev) => prev.map(r => r.id === rowId ? { ...r, defaultValue } : r))}
        onEditingRowCommentChange={(rowId, comment) => setEditingRows((prev) => prev.map(r => r.id === rowId ? { ...r, comment } : r))}
        onEditingRowExtraAttributesChange={(rowId, extraAttributes) => setEditingRows((prev) => prev.map(r => r.id === rowId ? { ...r, extraAttributes } as any : r))}
        onMoveEditingRowUp={(rowId) => {
          const index = editingRows.findIndex(r => r.id === rowId);
          if (index > 0) {
            const newRows = [...editingRows];
            [newRows[index], newRows[index - 1]] = [newRows[index - 1], newRows[index]];
            setEditingRows(newRows);
          }
        }}
        onMoveEditingRowDown={(rowId) => {
          const index = editingRows.findIndex(r => r.id === rowId);
          if (index < editingRows.length - 1) {
            const newRows = [...editingRows];
            [newRows[index], newRows[index + 1]] = [newRows[index + 1], newRows[index]];
            setEditingRows(newRows);
          }
        }}
        onDeleteEditingRow={(rowId) => setEditingRows((prev) => prev.filter(r => r.id !== rowId))}
        onClose={() => setCreateTableModal(null)}
        onSave={() => void handleCreateTable()}
        onAddColumn={handleAddColumn}
      />

      {/* Add row modal */}
      {addRowModalOpen && selectedTableInfo?.columns && (
        <div className="modal-overlay" onClick={() => handleCancelNewRow()}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
            <div className="modal-card-body" style={{ maxHeight: "60vh", overflowY: "auto" }}>
              {addRowError && (
                <div className="alert alert-danger" style={{ marginBottom: "12px" }}>
                  {addRowError}
                </div>
              )}

              {/* Column input table */}
              <table className="form-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", fontWeight: "600", fontSize: "12px", color: "#666", paddingBottom: "8px" }}>
                      {t("mysql.tableManager.columnName")}
                    </th>
                    <th style={{ textAlign: "left", fontWeight: "600", fontSize: "12px", color: "#666", paddingBottom: "8px" }}>
                      {t("mysql.tableManager.value")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTableInfo.columns.map((col) => (
                    <tr key={col.field} style={{ borderBottom: "1px solid #e8e8e8" }}>
                      <td style={{ padding: "8px 0", fontSize: "12px", color: "#333", width: "30%", paddingRight: "8px" }}>
                        <div style={{ fontWeight: "500" }}>{col.field}</div>
                        <div style={{ fontSize: "11px", color: "#999" }}>
                          {col.type}
                          {col.null === "YES" ? " (NULL)" : " (NOT NULL)"}
                        </div>
                      </td>
                      <td style={{ padding: "8px 0", fontSize: "12px" }}>
                        <input
                          type="text"
                          className="form-control"
                          value={addRowFormData[col.field] || ""}
                          onChange={(e) =>
                            setAddRowFormData({
                              ...addRowFormData,
                              [col.field]: e.target.value
                            })
                          }
                          placeholder={
                            col.default !== null && col.default !== undefined
                              ? `${col.default}`
                              : ""
                          }
                          style={{ fontSize: "12px" }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="modal-card-footer" style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                className="btn btn-sm btn-ghost"
                onClick={handleCancelNewRow}
                type="button"
              >
                {t("common.cancel")}
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={handleSaveNewRow}
                type="button"
              >
                {t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {exportSuccessMessage && (
        <div className="export-success-overlay" onClick={() => setExportSuccessMessage(null)}>
          <div className="export-success-modal" onClick={(e) => e.stopPropagation()}>
            <div className="export-success-icon">💾</div>
            <h3 className="export-success-title">{t("mysql.tableManager.exportSuccess")}</h3>
            <p className="export-success-message">
              {t("mysql.tableManager.exportedSuccessfully", { path: exportSuccessMessage })}
            </p>
            <button
              type="button"
              className="export-success-button"
              onClick={() => setExportSuccessMessage(null)}
            >
              {t("common.ok")}
            </button>
          </div>
        </div>
      )}

      {createTableSuccess && (
        <div className="export-success-overlay" onClick={() => setCreateTableSuccess(null)}>
          <div className="export-success-modal" onClick={(e) => e.stopPropagation()}>
            <div className="export-success-icon">✨</div>
            <h3 className="export-success-title">{t("mysql.tableManager.createTableSuccess")}</h3>
            <p className="export-success-message">
              {t("mysql.tableManager.tableCreatedWithName", { name: createTableSuccess })}
            </p>
            <button
              type="button"
              className="export-success-button"
              onClick={() => setCreateTableSuccess(null)}
            >
              {t("common.ok")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
