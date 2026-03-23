import type { Dispatch, RefObject, SetStateAction } from "react";
import { useCallback, useEffect } from "react";
import type { BoolType, ContextMenuState, SortDirection } from "../types";

interface UseEsContextMenuParams<Row> {
  contextMenu: ContextMenuState;
  contextMenuRef: RefObject<HTMLDivElement | null>;
  setContextMenu: Dispatch<SetStateAction<ContextMenuState>>;
  setExpandedRows: Dispatch<SetStateAction<Set<string>>>;
  onAddConditionFromContext: (boolType: BoolType) => void;
  onAddSortFromContext: (direction: SortDirection) => void;
  onDeleteDoc: (docIndex: string, docId: string) => void;
  onEditDoc: (row: Row) => void;
}

export function useEsContextMenu<Row>({
  contextMenu,
  contextMenuRef,
  setContextMenu,
  setExpandedRows,
  onAddConditionFromContext,
  onAddSortFromContext,
  onDeleteDoc,
  onEditDoc,
}: UseEsContextMenuParams<Row>) {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [contextMenuRef, setContextMenu]);

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, [setContextMenu]);

  const handleContextMenu = useCallback((event: React.MouseEvent, row: Row, field?: string, value?: unknown) => {
    event.preventDefault();
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      row,
      field,
      value,
    });
  }, [setContextMenu]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    closeContextMenu();
  }, [closeContextMenu]);

  const copyValue = useCallback(() => {
    if (contextMenu.value === undefined) {
      return;
    }
    const text = typeof contextMenu.value === "object" ? JSON.stringify(contextMenu.value) : String(contextMenu.value);
    copyToClipboard(text);
  }, [contextMenu.value, copyToClipboard]);

  const copyRow = useCallback(() => {
    if (!contextMenu.row) {
      return;
    }
    copyToClipboard(JSON.stringify((contextMenu.row as { _source?: unknown })._source, null, 2));
  }, [contextMenu.row, copyToClipboard]);

  const toggleRowExpand = useCallback((docId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
    closeContextMenu();
  }, [closeContextMenu, setExpandedRows]);

  const handleDeleteRow = useCallback(() => {
    const row = contextMenu.row as { _index: string; _id: string } | null;
    if (!row) {
      return;
    }
    onDeleteDoc(row._index, row._id);
    closeContextMenu();
  }, [closeContextMenu, contextMenu.row, onDeleteDoc]);

  const handleEditRow = useCallback(() => {
    if (!contextMenu.row) {
      return;
    }
    onEditDoc(contextMenu.row as Row);
    closeContextMenu();
  }, [closeContextMenu, contextMenu.row, onEditDoc]);

  const handleAddCondition = useCallback((boolType: BoolType) => {
    onAddConditionFromContext(boolType);
    closeContextMenu();
  }, [closeContextMenu, onAddConditionFromContext]);

  const handleAddSort = useCallback((direction: SortDirection) => {
    onAddSortFromContext(direction);
    closeContextMenu();
  }, [closeContextMenu, onAddSortFromContext]);

  return {
    closeContextMenu,
    copyRow,
    copyValue,
    handleAddCondition,
    handleAddSort,
    handleContextMenu,
    handleDeleteRow,
    handleEditRow,
    toggleRowExpand,
  };
}