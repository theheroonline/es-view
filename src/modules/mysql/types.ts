import type { EngineType, SshTunnelConfig } from "../../lib/types";

export interface MysqlConnection {
  id: string;
  name: string;
  engine: EngineType;
  host: string;
  port: number;
  database?: string;
  username?: string;
  password?: string;
  ssh?: SshTunnelConfig;
  sshPassword?: string;
}

export interface DatabaseMeta {
  name: string;
}

export interface TableMeta {
  name: string;
}

export interface ColumnMeta {
  field: string;
  type: string;
  null: string;
  key: string;
  default: string | null;
  extra: string;
}

export interface IndexMeta {
  name: string;
  columns: string[];
  unique: boolean;
  primary: boolean;
  indexType: string;
}

// Re-export binary value utilities from shared lib
export { isBinaryCellValue, decodeCellValue, type BinaryCellValue } from "../../lib/binaryValue";

export type MysqlFilterOperator =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "isNull"
  | "isNotNull"
  | "emptyString"
  | "notEmptyString";

export interface MysqlFilterConditionNode {
  id: string;
  kind: "condition";
  column: string;
  operator: MysqlFilterOperator;
  value?: string;
}

export interface MysqlFilterGroupNode {
  id: string;
  kind: "group";
  mode: "and" | "or";
  children: MysqlFilterNode[];
}

export type MysqlFilterNode = MysqlFilterConditionNode | MysqlFilterGroupNode;

export interface MysqlOpenedTable {
  database: string;
  table: string;
  view: "data" | "structure" | "info";
  filterTree?: MysqlFilterGroupNode;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  visibleColumns?: string[];
  page?: number;
  pageSize?: number;
}

export function getMysqlOpenedTableKey(database: string, table: string) {
  return `${database}::${table}`;
}

export function getMysqlOpenedTableTabKey(database: string, table: string, view: string) {
  return `${database}::${table}::${view}`;
}

export interface MysqlTableDataCacheEntry {
  columns: string[];
  rows: Array<Array<unknown>>;
  total: number;
  page: number;
  pageSize: number;
  columnMeta: ColumnMeta[];
  tableInfo: { columns: ColumnMeta[]; rowCount: number; info: unknown } | null;
  dataColumns: string[];
  cachedAt: number;
}

export interface MysqlQueryResult {
  columns: string[];
  rows: Array<Array<unknown>>;
  affectedRows: number;
  isResultSet: boolean;
}

export interface ExecutedStatementResult {
  id: string;
  sql: string;
  effectiveSql: string;
  mode: "execute" | "explain";
  durationMs: number;
  connectionName: string;
  databaseUsed?: string;
  result?: MysqlQueryResult;
  explainResult?: MysqlQueryResult;
  error?: string;
}

export interface SqlQueryState {
  sql: string;
  results: ExecutedStatementResult[];
}

// Query Generator Types
export type FilterOperator =
  | "=" | "!=" | ">" | "<" | ">=" | "<="
  | "LIKE" | "NOT LIKE"
  | "IN"
  | "BETWEEN"
  | "IS NULL" | "IS NOT NULL";

export interface FilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string | number | boolean | null;
  dataType?: string;
}

export interface FilterGroup {
  conditions: FilterCondition[];
  operator: "AND" | "OR";
}
