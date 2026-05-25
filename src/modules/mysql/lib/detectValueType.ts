import type { ColumnType } from "../types/columnTypes";

const NUMBER_TYPES = new Set([
  "TINYINT", "SMALLINT", "MEDIUMINT", "INT", "INTEGER", "BIGINT",
  "FLOAT", "DOUBLE", "DECIMAL", "NUMERIC", "FIXED", "BIT",
]);

const DATETIME_TYPES = new Set([
  "DATE", "TIME", "DATETIME", "TIMESTAMP", "YEAR",
]);

const BOOLEAN_TYPES = new Set(["BOOL", "BOOLEAN"]);

const BINARY_TYPES = new Set([
  "BLOB", "TINYBLOB", "MEDIUMBLOB", "LONGBLOB",
  "BINARY", "VARBINARY",
]);

/**
 * Extract base type from MySQL type string (e.g. "int(11)" → "INT", "varchar(255)" → "VARCHAR")
 */
export function extractBaseType(mysqlType: string): string {
  return mysqlType.split(/[(_,]/)[0].toUpperCase();
}

export function getDbTypeCategory(mysqlType: string): ColumnType {
  const baseType = extractBaseType(mysqlType);
  if (NUMBER_TYPES.has(baseType)) return "number";
  if (DATETIME_TYPES.has(baseType)) return "datetime";
  if (BOOLEAN_TYPES.has(baseType)) return "boolean";
  if (BINARY_TYPES.has(baseType)) return "binary";
  return "string";
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}:\d{2})?$/;
const BOOL_REGEX = /^(true|false|0|1)$/i;

export function detectValueType(
  cellValue: unknown,
  mysqlTypeOrCategory?: string | ColumnType
): { category: ColumnType; align: "left" | "right" | "center" } {
  if (cellValue === null || cellValue === undefined) {
    return { category: "string", align: "left" };
  }

  // If a ColumnType is passed directly, use it
  if (mysqlTypeOrCategory && ["number", "datetime", "boolean", "binary", "string"].includes(mysqlTypeOrCategory)) {
    const category = mysqlTypeOrCategory as ColumnType;
    return { category, align: getAlignForCategory(category) };
  }

  const str = typeof cellValue === "string" ? cellValue.trim() : "";

  if (BOOL_REGEX.test(str)) {
    return { category: "boolean", align: "center" };
  }

  if (str !== "" && !isNaN(Number(str))) {
    return { category: "number", align: "right" };
  }

  if (DATE_REGEX.test(str)) {
    return { category: "datetime", align: "right" };
  }

  // If mysqlType string is provided, use it for classification
  if (mysqlTypeOrCategory && typeof mysqlTypeOrCategory === "string") {
    const category = getDbTypeCategory(mysqlTypeOrCategory);
    return { category, align: getAlignForCategory(category) };
  }

  return { category: "string", align: "left" };
}

function getAlignForCategory(category: ColumnType): "left" | "right" | "center" {
  switch (category) {
    case "number":
    case "datetime":
      return "right";
    case "boolean":
      return "center";
    default:
      return "left";
  }
}

export function getTypeColor(category: ColumnType, isNull: boolean): string {
  if (isNull) return "#6b7885";
  switch (category) {
    case "number":
      return "#0052cc";
    case "datetime":
      return "#006600";
    case "boolean":
      return "#ff6400";
    case "binary":
      return "#646464";
    default:
      return "inherit";
  }
}

export function formatTypeLabel(mysqlType: string): string {
  const upper = mysqlType.toUpperCase();
  const shortForms: Record<string, string> = {
    "VARCHAR": "VARCHAR",
    "TINYINT": "TINYINT",
    "SMALLINT": "SMALLINT",
    "MEDIUMINT": "MEDIUMINT",
    "BIGINT": "BIGINT",
    "INTEGER": "INT",
    "DECIMAL": "DECIMAL",
    "NUMERIC": "NUMERIC",
    "DATETIME": "DATETIME",
    "TIMESTAMP": "TIMESTAMP",
    "VARBINARY": "VARBINARY",
    "BLOB": "BLOB",
    "TEXT": "TEXT",
    "JSON": "JSON",
    "ENUM": "ENUM",
    "SET": "SET",
  };
  return shortForms[upper] || mysqlType;
}
