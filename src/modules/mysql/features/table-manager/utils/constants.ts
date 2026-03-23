/**
 * Constants and default values for TableManager
 */

import type { DataState, MysqlColumnTypeOption } from "./typeHelpers";

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
