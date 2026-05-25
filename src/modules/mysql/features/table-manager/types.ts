import type { MysqlFilterConditionNode, MysqlFilterGroupNode } from "../../types";
import type { ColumnMeta, IndexMeta } from "../../types";

export type FilterConditionDraft = MysqlFilterConditionNode;
export type FilterGroupDraft = MysqlFilterGroupNode;

export interface TableInfo {
  database: string;
  table: string;
  columns?: ColumnMeta[];
  rowCount?: number;
  info?: TableDetailInfo;
  loading: boolean;
}

export interface TableDetailInfo {
  engine: string;
  rowFormat: string;
  tableRows: number;
  autoIncrement: string;
  createTime: string;
  updateTime: string;
  checkTime: string;
  collation: string;
  indexLength: number;
  dataLength: number;
  maxDataLength: number;
  dataFree: number;
  avgRowLength: number;
  comment: string;
  createOptions: string;
  createSql: string;
}

export interface DataState {
  columns: string[];
  rows: Array<Array<unknown>>;
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: string;
}

export type RightPanelTab = "structure" | "data" | "info";

export interface MysqlColumnTypeOption {
  value: string;
  label: string;
  lengthMode: "none" | "single" | "pair";
  supportsUnsigned?: boolean;
}

export interface TreeContextMenu {
  db: string;
  table: string;
  selectedTables: string[];
  x: number;
  y: number;
}

export interface DatabaseContextMenu {
  database: string;
  x: number;
  y: number;
}

export interface ExportSelectionModalState {
  database: string;
  availableTables: string[];
  selectedTables: string[];
  includeData: boolean;
}

export interface CreateTableColumn {
  id: string;
  name: string;
  type: string;
  length?: string;
  scale?: string;
  nullable: boolean;
  defaultValue: string;
  isPrimary: boolean;
  autoIncrement: boolean;
  comment?: string;
}

export interface CreateTableModalState {
  database: string;
  tableName: string;
  columns: CreateTableColumn[];
  charset: string;
  engine: string;
}

export interface EditingRow {
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
}

export interface RowContextMenu {
  x: number;
  y: number;
  rowIndex: number;
  columnIndex: number;
  column: string;
  value: unknown;
}

export interface ColumnHeaderContextMenu {
  x: number;
  y: number;
  column: string;
}

export interface CellEditorState {
  rowIndex: number;
  column: string;
  value: string;
}

export interface SelectedCell {
  key: string;
  rowIndex: number;
  columnIndex: number;
  column: string;
}

export type BatchEditMode = "text" | "null" | "empty";

export type ColumnEditMode = "add" | "edit";

export interface ColumnEditForm {
  field: string;
  typeName: string;
  length: string;
  scale: string;
  unsigned: boolean;
  customType: string;
  nullable: boolean;
  defaultValue: string;
  extra: string;
  autoIncrement: boolean;
}

export interface TableSelectionAnchor {
  rowIndex: number;
  columnIndex: number;
}

export interface SortDraft {
  column: string;
  direction: "asc" | "desc";
}

export interface TableManagerConfirmDialogState {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  isDangerous?: boolean;
}

export interface IndexFormState {
  name: string;
  columns: string[];
  unique: boolean;
  indexType: string;
}

export type TableManagerIndex = IndexMeta;