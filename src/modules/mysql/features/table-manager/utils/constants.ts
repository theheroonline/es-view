/**
 * Constants and default values for TableManager
 */

import type { DataState, MysqlColumnTypeOption } from "./typeHelpers";
import type { MysqlFilterOperator } from "../../../types";

export const defaultDataState: DataState = {
  columns: [],
  rows: [],
  total: 0,
  page: 1,
  pageSize: 100,
  loading: false,
  error: ""
};

export const mysqlColumnTypeOptions: MysqlColumnTypeOption[] = [
  { value: "tinyint", label: "TINYINT", lengthMode: "single", supportsUnsigned: true },
  { value: "smallint", label: "SMALLINT", lengthMode: "single", supportsUnsigned: true },
  { value: "mediumint", label: "MEDIUMINT", lengthMode: "single", supportsUnsigned: true },
  { value: "int", label: "INT", lengthMode: "single", supportsUnsigned: true },
  { value: "bigint", label: "BIGINT", lengthMode: "single", supportsUnsigned: true },
  { value: "decimal", label: "DECIMAL", lengthMode: "pair", supportsUnsigned: true },
  { value: "float", label: "FLOAT", lengthMode: "pair", supportsUnsigned: true },
  { value: "double", label: "DOUBLE", lengthMode: "pair", supportsUnsigned: true },
  { value: "char", label: "CHAR", lengthMode: "single" },
  { value: "varchar", label: "VARCHAR", lengthMode: "single" },
  { value: "text", label: "TEXT", lengthMode: "none" },
  { value: "longtext", label: "LONGTEXT", lengthMode: "none" },
  { value: "date", label: "DATE", lengthMode: "none" },
  { value: "datetime", label: "DATETIME", lengthMode: "none" },
  { value: "timestamp", label: "TIMESTAMP", lengthMode: "none" },
  { value: "time", label: "TIME", lengthMode: "none" },
  { value: "json", label: "JSON", lengthMode: "none" },
  { value: "custom", label: "Custom", lengthMode: "none" }
];

export const getColumnTypeOption = (value: string) => mysqlColumnTypeOptions.find((option) => option.value === value);

/**
 * Filter operator definitions with their i18n keys.
 * Use `buildFilterOperators(t)` to get localized labels.
 */
export const FILTER_OPERATORS: Array<{ value: MysqlFilterOperator; i18nKey: string }> = [
  { value: "eq", i18nKey: "mysql.tableManager.operatorEq" },
  { value: "ne", i18nKey: "mysql.tableManager.operatorNe" },
  { value: "gt", i18nKey: "mysql.tableManager.operatorGt" },
  { value: "gte", i18nKey: "mysql.tableManager.operatorGte" },
  { value: "lt", i18nKey: "mysql.tableManager.operatorLt" },
  { value: "lte", i18nKey: "mysql.tableManager.operatorLte" },
  { value: "between", i18nKey: "mysql.tableManager.operatorBetween" },
  { value: "contains", i18nKey: "mysql.tableManager.operatorContains" },
  { value: "startsWith", i18nKey: "mysql.tableManager.operatorStartsWith" },
  { value: "endsWith", i18nKey: "mysql.tableManager.operatorEndsWith" },
  { value: "isNull", i18nKey: "mysql.tableManager.operatorIsNull" },
  { value: "isNotNull", i18nKey: "mysql.tableManager.operatorIsNotNull" },
  { value: "emptyString", i18nKey: "mysql.tableManager.operatorEmptyString" },
  { value: "notEmptyString", i18nKey: "mysql.tableManager.operatorNotEmptyString" },
];

export function buildFilterOperators(t: (key: string) => string): Array<{ value: MysqlFilterOperator; label: string }> {
  return FILTER_OPERATORS.map(({ value, i18nKey }) => ({ value, label: t(i18nKey) }));
}
