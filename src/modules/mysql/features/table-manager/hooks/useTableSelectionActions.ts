import { type MouseEvent, useCallback } from "react";
import type { SelectedCell } from "../utils";

interface UseTableSelectionActionsProps {
  maxShiftSelectionCells: number;
  columns: string[];
  selectedCells: SelectedCell[];
  selectionAnchor: { rowIndex: number; columnIndex: number } | null;
  selectedCellKeySet: Set<string>;
  t: (key: string, options?: any) => string;
  setSelectedCells: (updater: SelectedCell[] | ((prev: SelectedCell[]) => SelectedCell[])) => void;
  setSelectionAnchor: (anchor: { rowIndex: number; columnIndex: number } | null) => void;
  setSelectedRowIndex: (updater: number | null | ((prev: number | null) => number | null)) => void;
  setError: (message: string) => void;
  setRowContextMenu: (menu: {
    x: number;
    y: number;
    rowIndex: number;
    columnIndex: number;
    column: string;
    value: unknown;
  } | null) => void;
}

export function useTableSelectionActions({
  maxShiftSelectionCells,
  columns,
  selectedCells,
  selectionAnchor,
  selectedCellKeySet,
  t,
  setSelectedCells,
  setSelectionAnchor,
  setSelectedRowIndex,
  setError,
  setRowContextMenu,
}: UseTableSelectionActionsProps) {
  const createSelectedCell = useCallback((rowIndex: number, columnIndex: number): SelectedCell => ({
    key: `${rowIndex}:${columnIndex}`,
    rowIndex,
    columnIndex,
    column: columns[columnIndex] ?? ""
  }), [columns]);

  const buildSelectedCells = useCallback((start: { rowIndex: number; columnIndex: number }, end: { rowIndex: number; columnIndex: number }) => {
    const rowStart = Math.min(start.rowIndex, end.rowIndex);
    const rowEnd = Math.max(start.rowIndex, end.rowIndex);
    const colStart = Math.min(start.columnIndex, end.columnIndex);
    const colEnd = Math.max(start.columnIndex, end.columnIndex);
    const estimatedCellCount = (rowEnd - rowStart + 1) * (colEnd - colStart + 1);

    if (estimatedCellCount > maxShiftSelectionCells) {
      return null;
    }

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
  }, [createSelectedCell, maxShiftSelectionCells]);

  const handleCellClick = useCallback((event: MouseEvent<HTMLTableCellElement>, rowIndex: number, columnIndex: number) => {
    const currentCell = createSelectedCell(rowIndex, columnIndex);
    if (!currentCell.column) return;

    const isSameSingleSelection =
      selectedCells.length === 1 &&
      selectedCells[0]?.key === currentCell.key &&
      !event.shiftKey &&
      !(event.ctrlKey || event.metaKey);

    if (isSameSingleSelection) {
      setSelectedRowIndex((prev) => (prev === rowIndex ? prev : rowIndex));
      return;
    }

    if (event.shiftKey && selectionAnchor) {
      const nextCells = buildSelectedCells(selectionAnchor, { rowIndex, columnIndex });
      if (!nextCells) {
        setError(t("mysql.tableManager.shiftSelectionLimitHint", { max: maxShiftSelectionCells }));
        return;
      }
      setSelectedCells(nextCells);
      setSelectedRowIndex(null);
    } else if (event.ctrlKey || event.metaKey) {
      setSelectedCells((prev) => prev.some((cell) => cell.key === currentCell.key)
        ? prev.filter((cell) => cell.key !== currentCell.key)
        : [...prev, currentCell]);
      setSelectionAnchor({ rowIndex, columnIndex });
      setSelectedRowIndex(null);
    } else {
      setSelectedCells([currentCell]);
      setSelectionAnchor({ rowIndex, columnIndex });
      setSelectedRowIndex((prev) => (prev === rowIndex ? prev : rowIndex));
    }
  }, [buildSelectedCells, createSelectedCell, maxShiftSelectionCells, selectedCells, selectionAnchor, setError, setSelectedCells, setSelectedRowIndex, setSelectionAnchor, t]);

  const handleRowContextMenu = useCallback((e: MouseEvent<HTMLElement>, rowIndex: number, column: string, value: unknown) => {
    e.preventDefault();
    e.stopPropagation();

    const columnIndex = columns.indexOf(column);
    const selectedCell = createSelectedCell(rowIndex, columnIndex);
    if (selectedCell.column && !selectedCellKeySet.has(selectedCell.key)) {
      setSelectedCells([selectedCell]);
      setSelectionAnchor({ rowIndex, columnIndex });
    }
    const x = Math.max(8, Math.min(e.clientX, window.innerWidth - 260));
    const y = Math.max(8, Math.min(e.clientY, window.innerHeight - 420));
    setRowContextMenu({ x, y, rowIndex, columnIndex, column, value });
  }, [columns, createSelectedCell, selectedCellKeySet, setRowContextMenu, setSelectedCells, setSelectionAnchor]);

  return {
    handleCellClick,
    handleRowContextMenu,
  };
}
