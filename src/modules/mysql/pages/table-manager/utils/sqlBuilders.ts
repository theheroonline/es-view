/**
 * SQL building and escaping utilities for MySQL queries
 */

import type { MysqlFilterOperator } from "../../../../../state/MysqlContext";
import type { FilterConditionDraft } from "./typeHelpers";

const BETWEEN_VALUE_SEPARATOR = "|||";

export const splitBetweenValue = (value = ""): [string, string] => {
  const [start = "", end = ""] = value.split(BETWEEN_VALUE_SEPARATOR);
  return [start, end];
};

export const joinBetweenValue = (start: string, end: string) => `${start}${BETWEEN_VALUE_SEPARATOR}${end}`;

/**
 * Escape MySQL identifier (column name, table name, database name)
 * Wraps in backticks and escapes internal backticks
 */
export const escapeSqlIdentifier = (value: string) => `\`${value.replace(/`/g, "``")}\``;

/**
 * Escape MySQL string literal
 * Wraps in single quotes and escapes internal single quotes
 */
export const escapeSqlLiteral = (value: string) => `'${value.replace(/'/g, "''")}'`;

/**
 * Escape value for LIKE operator
 * Escapes special characters: \, %, _
 */
export const escapeSqlLikeLiteral = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/'/g, "''");

/**
 * Format value for SQL based on type
 * - null/undefined → "NULL"
 * - number → string number
 * - boolean → "0" or "1"
 * - others → escaped string literal
 */
export const formatSqlValue = (value: unknown): string => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  return escapeSqlLiteral(String(value));
};

/**
 * Build SQL WHERE condition from filter condition node
 * Returns null if condition is invalid
 */
export const buildConditionSql = (
  condition: FilterConditionDraft,
  { escapeSqlIdentifier: identifierEscaper = escapeSqlIdentifier, escapeSqlLikeLiteral: likeLiteralEscaper = escapeSqlLikeLiteral } = {}
): string | null => {
  const column = condition.column.trim();
  if (!column) return null;

  const identifier = identifierEscaper(column);
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
    case "between": {
      const [start, end] = splitBetweenValue(conditionValue);
      if (!start.trim() || !end.trim()) return null;
      return `${identifier} BETWEEN ${escapeSqlLiteral(start)} AND ${escapeSqlLiteral(end)}`;
    }
    case "lt":
      return `${identifier} < ${escapeSqlLiteral(conditionValue)}`;
    case "lte":
      return `${identifier} <= ${escapeSqlLiteral(conditionValue)}`;
    case "contains":
      return `${identifier} LIKE '%${likeLiteralEscaper(conditionValue)}%' ESCAPE '\\\\'`;
    case "startsWith":
      return `${identifier} LIKE '${likeLiteralEscaper(conditionValue)}%' ESCAPE '\\\\'`;
    case "endsWith":
      return `${identifier} LIKE '%${likeLiteralEscaper(conditionValue)}' ESCAPE '\\\\'`;
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
};

/**
 * Check if operator requires a value
 * Some operators like IS NULL don't need values
 */
export const operatorNeedsValue = (operator: MysqlFilterOperator): boolean => {
  return !["isNull", "isNotNull", "emptyString", "notEmptyString"].includes(operator);
};

/**
 * Build DEFAULT clause for column definition
 * Handles: NULL, CURRENT_TIMESTAMP, numbers, strings
 */
export const buildDefaultClause = (value: string): string => {
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
