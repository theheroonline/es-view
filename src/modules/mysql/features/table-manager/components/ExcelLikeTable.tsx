import { memo, type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DEFAULT_COLUMN_WIDTH, MIN_COLUMN_WIDTH, isCellSelected, useExcelTable } from "../hooks/useExcelTable";
import { useInlineEditor } from "../hooks/useInlineEditor";
import { decodeCellValue } from "../../../../../lib/binaryValue";

/**
 * ExcelLikeTable 组件
 *
 * MySQL 专用的 Excel 式表格实现
 * 基于 TanStack Table + React Virtual 虚拟滚动
 *
 * 功能：
 * - 虚拟滚动渲染（支持百万行数据）
 * - 单元格选中和多选
 * - 行展开 JSON 显示
 * - 固定列宽和可见列控制
 * - 右键菜单支持
 * - 操作按钮（编辑、删除）
 *
 * 注意：此组件完全独立实现，不借鉴其他模块（ES、Redis）
 */

interface ExcelLikeTableProps {
  columns: string[];
  data: any[][];
  selectedCellKeySet: Set<string>;
  selectedRowIndex: number | null;
  loading?: boolean;
  tableKey?: string; // 用于持久化列配置

  // Event handlers
  onCellClick: (event: MouseEvent<HTMLTableCellElement>, rowIndex: number, columnIndex: number) => void;
  onRowContextMenu: (event: MouseEvent<HTMLTableCellElement>, rowIndex: number, column: string, cell: unknown) => void;
  onSaveCell: (rowIndex: number, columnIndex: number, columnName: string, newValue: string) => Promise<void>;
}

function ExcelLikeTableInner({
  columns,
  data,
  selectedCellKeySet,
  selectedRowIndex,
  loading = false,
  tableKey,
  onCellClick,
  onRowContextMenu,
  onSaveCell,
}: ExcelLikeTableProps) {
  const { t } = useTranslation();

  // 拖拽状态
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const activeResizeHandlersRef = useRef<{ mouseMove: ((e: globalThis.MouseEvent) => void) | null; mouseUp: (() => void) | null }>({
    mouseMove: null,
    mouseUp: null,
  });

  // 清理拖拽监听器（组件卸载时）
  useEffect(() => {
    return () => {
      const { mouseMove, mouseUp } = activeResizeHandlersRef.current;
      if (mouseMove) document.removeEventListener("mousemove", mouseMove);
      if (mouseUp) document.removeEventListener("mouseup", mouseUp);
    };
  }, []);

  // 行内编辑状态
  const { editingCell, startEditing, cancelEdit } = useInlineEditor();
  const editInputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // 当编辑单元格时，自动聚焦输入框
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // 使用 useCallback 包裹处理函数，避免每次渲染都创建新函数
  const handleCellClick = useCallback(
    (e: MouseEvent<HTMLTableCellElement>, rowIndex: number, columnIndex: number) => {
      e.stopPropagation();
      onCellClick(e, rowIndex, columnIndex);
    },
    [onCellClick]
  );

  const handleCellDoubleClick = useCallback(
    (rowIndex: number, columnIndex: number, columnName: string, cellValue: unknown) => {
      startEditing(rowIndex, columnIndex, columnName, cellValue);
    },
    [startEditing]
  );

  const handleCellContextMenu = useCallback(
    (e: MouseEvent<HTMLTableCellElement>, rowIndex: number, columnName: string, cellValue: unknown) => {
      e.stopPropagation();
      onRowContextMenu(e, rowIndex, columnName, cellValue);
    },
    [onRowContextMenu]
  );

  const handleInputKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLInputElement>) => {
      const inputEl = editInputRef.current as HTMLInputElement;
      if (!inputEl || !editingCell) return;

      if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const newValue = inputEl.value;
        const originalValue = editingCell.originalValue === null ? "" : String(editingCell.originalValue);

        if (newValue !== originalValue) {
          await onSaveCell(editingCell.rowIndex, editingCell.columnIndex, editingCell.columnName, newValue);
        }

        const nextRowIndex = editingCell.rowIndex + 1;
        if (nextRowIndex < data.length) {
          const nextCellValue = data[nextRowIndex]?.[editingCell.columnIndex];
          startEditing(nextRowIndex, editingCell.columnIndex, editingCell.columnName, nextCellValue);
        } else {
          cancelEdit();
        }
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        const newValue = inputEl.value;
        const originalValue = editingCell.originalValue === null ? "" : String(editingCell.originalValue);

        if (newValue !== originalValue) {
          await onSaveCell(editingCell.rowIndex, editingCell.columnIndex, editingCell.columnName, newValue);
        }
        cancelEdit();
      }
    },
    [editingCell, onSaveCell, data, startEditing, cancelEdit]
  );

  const handleInputBlur = useCallback(() => {
    const inputEl = editInputRef.current as HTMLInputElement;
    if (!inputEl || !editingCell) return;

    const newValue = inputEl.value;
    const originalValue = editingCell.originalValue === null ? "" : String(editingCell.originalValue);

    if (newValue !== originalValue) {
      onSaveCell(editingCell.rowIndex, editingCell.columnIndex, editingCell.columnName, newValue);
    }
    cancelEdit();
  }, [editingCell, onSaveCell, cancelEdit]);

  const handleInputClick = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    e.stopPropagation();
  }, []);

  // 使用 Hook 获取虚拟滚动和表格实例
  const {
    table,
    rowVirtualizer,
    virtualRows,
    rows,
    tableContainerRef,
    theadRef,
    columnOrder,
    columnWidths,
    setColumnOrder,
    setColumnWidth,
  } = useExcelTable({
    columns,
    data,
    tableKey,
  });

  // 获取表头
  const headerGroups = table.getHeaderGroups();
  const virtualPaddingTop = virtualRows.length > 0 ? virtualRows[0]!.start : 0;
  const virtualPaddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1]!.end
      : 0;
  const visibleOrderedColumns = useMemo(
    () => columnOrder.filter((column) => columns.includes(column)),
    [columnOrder, columns]
  );

  // 预计算列名到索引的映射，避免渲染循环中重复 indexOf
  const columnIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < columns.length; i++) {
      map.set(columns[i], i);
    }
    return map;
  }, [columns]);

  // ==================== 列拖拽处理 ====================

  const handleHeaderDragStart = (e: React.DragEvent<HTMLTableCellElement>, columnName: string) => {
    // Check if drag originated from the resizer area (use elementUnderPoint since e.target is always <th>)
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el?.closest(".excel-table-column-resizer")) {
      e.preventDefault();
      return;
    }

    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", columnName);
    setDraggedColumn(columnName);
  };

  const handleHeaderDragOver = (e: React.DragEvent<HTMLTableCellElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleHeaderDrop = (e: React.DragEvent<HTMLTableCellElement>, targetColumnName: string) => {
    e.preventDefault();
    const sourceColumnName = e.dataTransfer.getData("text/plain");

    if (sourceColumnName !== targetColumnName) {
      const sourceIndex = columnOrder.indexOf(sourceColumnName);
      const targetIndex = columnOrder.indexOf(targetColumnName);

      if (sourceIndex !== -1 && targetIndex !== -1) {
        const newOrder = [...columnOrder];
        newOrder.splice(sourceIndex, 1);
        newOrder.splice(targetIndex, 0, sourceColumnName);
        setColumnOrder(newOrder);
      }
    }

    setDraggedColumn(null);
  };

  const handleHeaderDragLeave = () => {
    setDraggedColumn(null);
  };

  // ==================== 列宽调整处理 ====================

  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>, columnName: string) => {
    e.preventDefault();
    e.stopPropagation();

    const currentWidth = columnWidths[columnName] || DEFAULT_COLUMN_WIDTH;
    const startX = e.clientX;
    let lastWidth = currentWidth;

    const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      lastWidth = Math.max(MIN_COLUMN_WIDTH, currentWidth + delta);
      setColumnWidth(columnName, lastWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      activeResizeHandlersRef.current.mouseMove = null;
      activeResizeHandlersRef.current.mouseUp = null;
      setColumnWidth(columnName, lastWidth, true);
    };

    activeResizeHandlersRef.current.mouseMove = handleMouseMove;
    activeResizeHandlersRef.current.mouseUp = handleMouseUp;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // 如果没有数据
  if (data.length === 0 && !loading) {
    return (
      <div className="excel-table-empty">
        <div className="excel-table-empty-message">{t("common.noData")}</div>
      </div>
    );
  }

  return (
    <div className="excel-table-wrapper">
      {/* 表格滚动容器 */}
      <div ref={tableContainerRef} className="excel-table-scroller">
        <table className="excel-table">
          {/* 表头 - 始终固定显示 */}
          <thead ref={theadRef} className="excel-table-head" style={{ position: "sticky", top: 0, zIndex: 10 }}>
            {headerGroups.map((headerGroup) => (
              <tr key={headerGroup.id} className="excel-table-header-row">
                {/* 数据列 */}
                {headerGroup.headers.map((header) => {
                  const columnName = header.column.columnDef.header?.toString() || "";
                  const columnWidth = columnWidths[columnName] || DEFAULT_COLUMN_WIDTH;
                  const isDragging = draggedColumn === columnName;

                  return (
                    <th
                      key={header.id}
                      data-column={columnName}
                      className={`excel-table-header-cell ${isDragging ? "excel-table-header-cell-dragging" : ""}`}
                      draggable
                      onDragStart={(e) => handleHeaderDragStart(e, columnName)}
                      onDragOver={handleHeaderDragOver}
                      onDrop={(e) => handleHeaderDrop(e, columnName)}
                      onDragLeave={handleHeaderDragLeave}
                      style={{ width: columnWidth }}
                    >
                      <div className="excel-table-header-content">
                        <span>{columnName}</span>
                        {/* 列宽调整分隔符 */}
                        <div
                          className="excel-table-column-resizer"
                          onMouseDown={(e) => handleResizeStart(e, columnName)}
                          title="拖拽调整列宽"
                        />
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          {/* 表体 - 虚拟滚动 */}
          <tbody className="excel-table-body">
            {virtualPaddingTop > 0 && (
              <tr aria-hidden="true">
                <td
                  colSpan={Math.max(visibleOrderedColumns.length, 1)}
                  style={{
                    height: `${virtualPaddingTop}px`,
                    padding: 0,
                    border: 0,
                    background: "transparent",
                  }}
                />
              </tr>
            )}

            {/* 虚拟行渲染 */}
            {virtualRows.length > 0 ? (
              virtualRows.map((virtualItem) => {
                const row = rows[virtualItem.index];
                if (!row) return null;

                const rowIndex = row.original._rowIndex;
                const isRowSelected = selectedRowIndex !== null && selectedRowIndex === rowIndex;

                return (
                  <tr
                    key={row.id}
                    data-index={virtualItem.index}
                    ref={(node) => {
                      if (node) {
                        rowVirtualizer.measureElement(node);
                      }
                    }}
                    className={`excel-table-row ${isRowSelected ? "excel-table-row-selected" : ""}`}
                  >
                    {/* 数据单元格 */}
                    {visibleOrderedColumns.map((columnName) => {
                      const columnIndex = columnIndexMap.get(columnName) ?? 0;
                      const cellValue = data[rowIndex]?.[columnIndex];
                      const isSelected = isCellSelected(rowIndex, columnIndex, selectedCellKeySet);
                      const columnWidth = columnWidths[columnName] || DEFAULT_COLUMN_WIDTH;
                      const isEditing =
                        editingCell?.rowIndex === rowIndex &&
                        editingCell?.columnIndex === columnIndex;

                      return (
                        <td
                          key={`cell-${rowIndex}-${columnName}`}
                          data-column={columnName}
                          className={`excel-table-cell ${isSelected ? "excel-table-cell-selected" : ""} ${
                            isEditing ? "excel-table-cell-editing" : ""
                          }`}
                          title={cellValue === null ? "NULL" : decodeCellValue(cellValue)}
                          style={{ width: columnWidth }}
                          onClick={(e) => handleCellClick(e, rowIndex, columnIndex)}
                          onDoubleClick={() => handleCellDoubleClick(rowIndex, columnIndex, columnName, cellValue)}
                          onContextMenu={(e) => handleCellContextMenu(e, rowIndex, columnName, cellValue)}
                        >
                          {isEditing ? (
                            <input
                              ref={editInputRef as any}
                              type="text"
                              className="excel-table-cell-input"
                              defaultValue={editingCell.originalValue === null ? "" : String(editingCell.originalValue)}
                              onKeyDown={handleInputKeyDown}
                              onBlur={handleInputBlur}
                              onClick={handleInputClick}
                              autoComplete="off"
                              spellCheck="false"
                            />
                          ) : cellValue === null ? (
                            <span className="excel-table-cell-null">NULL</span>
                          ) : (
                            decodeCellValue(cellValue)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={columns.length} className="excel-table-cell" style={{ textAlign: "center", padding: "20px" }}>
                  {loading ? t("common.loading") : t("common.noData")}
                </td>
              </tr>
            )}

            {virtualPaddingBottom > 0 && (
              <tr aria-hidden="true">
                <td
                  colSpan={Math.max(visibleOrderedColumns.length, 1)}
                  style={{
                    height: `${virtualPaddingBottom}px`,
                    padding: 0,
                    border: 0,
                    background: "transparent",
                  }}
                />
              </tr>
            )}
          </tbody>
        </table>

      </div>
    </div>
  );
}

export const ExcelLikeTable = memo(ExcelLikeTableInner);
