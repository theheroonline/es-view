import { useCallback } from "react";
import type { ColumnHeaderContextMenu } from "../utils";

interface UseTableColumnHeaderMenuActionsProps {
  columnHeaderContextMenu: ColumnHeaderContextMenu | null;
  applySort: (column: string, direction: "asc" | "desc") => Promise<void>;
  clearSort: () => Promise<void>;
  setColumnHeaderContextMenu: (menu: ColumnHeaderContextMenu | null) => void;
}

export function useTableColumnHeaderMenuActions({
  columnHeaderContextMenu,
  applySort,
  clearSort,
  setColumnHeaderContextMenu,
}: UseTableColumnHeaderMenuActionsProps) {
  const closeColumnHeaderMenu = useCallback(() => {
    setColumnHeaderContextMenu(null);
  }, [setColumnHeaderContextMenu]);

  const handleColumnHeaderSortAsc = useCallback(() => {
    if (!columnHeaderContextMenu) return;
    void applySort(columnHeaderContextMenu.column, "asc");
    closeColumnHeaderMenu();
  }, [applySort, closeColumnHeaderMenu, columnHeaderContextMenu]);

  const handleColumnHeaderSortDesc = useCallback(() => {
    if (!columnHeaderContextMenu) return;
    void applySort(columnHeaderContextMenu.column, "desc");
    closeColumnHeaderMenu();
  }, [applySort, closeColumnHeaderMenu, columnHeaderContextMenu]);

  const handleColumnHeaderClearSort = useCallback(() => {
    void clearSort();
    closeColumnHeaderMenu();
  }, [clearSort, closeColumnHeaderMenu]);

  return {
    handleColumnHeaderSortAsc,
    handleColumnHeaderSortDesc,
    handleColumnHeaderClearSort,
  };
}
