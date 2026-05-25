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
}

export interface UseInlineEditorReturn {
  editingCell: EditingCell | null;
  startEditing: (rowIndex: number, columnIndex: number, columnName: string, currentValue: unknown) => void;
  cancelEdit: () => void;
}

export function useInlineEditor(): UseInlineEditorReturn {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);

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
    });
  };

  const cancelEdit = () => {
    setEditingCell(null);
  };

  return {
    editingCell,
    startEditing,
    cancelEdit,
  };
}
