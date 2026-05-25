/**
 * Cell and row selection utilities for data table
 */

import type { SelectedCell } from "./typeHelpers";

/**
 * Create a selected cell object with auto-generated key
 * The key is used for tracking and deduplication
 */
export const createSelectedCell = (
  rowIndex: number,
  columnIndex: number,
  columns: string[]
): SelectedCell => ({
  key: `${rowIndex}:${columnIndex}`,
  rowIndex,
  columnIndex,
  column: columns[columnIndex] ?? ""
});

/**
 * Build range of selected cells from anchor to end point
 * Used for shift+click selection
 * Handles both forward and backward selection
 */
export const buildSelectedCells = (
  start: { rowIndex: number; columnIndex: number },
  end: { rowIndex: number; columnIndex: number },
  columns: string[]
): SelectedCell[] => {
  const rowStart = Math.min(start.rowIndex, end.rowIndex);
  const rowEnd = Math.max(start.rowIndex, end.rowIndex);
  const colStart = Math.min(start.columnIndex, end.columnIndex);
  const colEnd = Math.max(start.columnIndex, end.columnIndex);
  const cells: SelectedCell[] = [];

  for (let rowIndex = rowStart; rowIndex <= rowEnd; rowIndex += 1) {
    for (let columnIndex = colStart; columnIndex <= colEnd; columnIndex += 1) {
      const cell = createSelectedCell(rowIndex, columnIndex, columns);
      if (cell.column) {
        cells.push(cell);
      }
    }
  }

  return cells;
};
