/**
 * Data formatting utilities for display and SQL generation
 */

/**
 * Format date value for display
 * Returns "--" for null/undefined/empty values
 */
export const formatInfoDate = (value: unknown): string => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "--";
  }
  return String(value);
};

/**
 * Format text value for display
 * Returns "--" for null/undefined/empty values
 */
export const formatInfoText = (value: unknown): string => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "--";
  }
  return String(value);
};

/**
 * Convert value to safe number
 * Returns 0 for non-numeric or invalid values
 */
export const toSafeNumber = (value: unknown): number => {
  const nextValue = Number(value ?? 0);
  return Number.isFinite(nextValue) ? nextValue : 0;
};

/**
 * Format bytes to human-readable format
 * Example: 1024 → "1.00 KB (1024)"
 * Example: 5242880 → "5.00 MB (5242880)"
 */
export const formatBytes = (value: number): string => {
  if (value <= 0) return "0 B (0)";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]} (${value.toLocaleString()})`;
};

/**
 * Extract single row from query result
 * Returns object mapping column names to values
 * Example: columns=["id", "name"], rows=[[1, "John"]] → { id: 1, name: "John" }
 */
export const getSingleResultRow = (
  columns: string[],
  rows: Array<Array<unknown>>
): Record<string, unknown> | null => {
  const row = rows[0];
  if (!row) return null;
  return Object.fromEntries(columns.map((column, index) => [column, row[index]]));
};
