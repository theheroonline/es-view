import { useState } from "react";

/**
 * useInlineEditor Hook
 *
 * 管理表格行内编辑的状态和逻辑
 *
 * 功能：
 * - 编辑单个单元格（双击激活）
 * - 支持快捷键：
 *   - Enter: 保存当前单元格，移动到下一行相同列
 *   - Escape: 取消编辑，恢复原值
 *   - Tab: 保存当前单元格，移动到下一列
 *   - Shift+Tab: 保存当前单元格，移动到上一列
 * - 保存时调用 onSave 回调
 */

export interface EditingCell {
  rowIndex: number;
  columnIndex: number;
  columnName: string;
  originalValue: unknown;
  editValue: string;
}

export interface UseInlineEditorReturn {
  editingCell: EditingCell | null;
  startEditing: (rowIndex: number, columnIndex: number, columnName: string, currentValue: unknown) => void;
  updateEditValue: (newValue: string) => void;
  saveEdit: (onSave: (rowIndex: number, columnIndex: number, columnName: string, newValue: string) => Promise<void>) => Promise<void>;
  cancelEdit: () => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

export function useInlineEditor(): UseInlineEditorReturn {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const startEditing = (
    rowIndex: number,
    columnIndex: number,
    columnName: string,
    currentValue: unknown
  ) => {
    setEditingCell({
      rowIndex,
      columnIndex,
      columnName,
      originalValue: currentValue,
      editValue: currentValue === null ? "" : String(currentValue),
    });
  };

  const updateEditValue = (newValue: string) => {
    setEditingCell((prev) => (prev ? { ...prev, editValue: newValue } : null));
  };

  const saveEdit = async (
    onSave: (rowIndex: number, columnIndex: number, columnName: string, newValue: string) => Promise<void>
  ) => {
    if (!editingCell || isSaving) return;

    setIsSaving(true);
    try {
      await onSave(
        editingCell.rowIndex,
        editingCell.columnIndex,
        editingCell.columnName,
        editingCell.editValue
      );
      setEditingCell(null);
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!editingCell) return;

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        cancelEdit();
        break;
      case "Enter":
        // Enter: 保存并移动到下一行相同列
        e.preventDefault();
        // 由调用者处理保存和移动逻辑
        break;
      case "Tab":
        // Tab: 保存并移动到下一列
        e.preventDefault();
        // 由调用者处理保存和移动逻辑
        break;
    }
  };

  return {
    editingCell,
    startEditing,
    updateEditValue,
    saveEdit,
    cancelEdit,
    handleKeyDown,
  };
}
