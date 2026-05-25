import {
    getCoreRowModel,
    getExpandedRowModel,
    useReactTable,
    type ColumnDef,
    type Row,
} from "@tanstack/react-table";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * useExcelTable Hook
 *
 * 为 MySQL TableManager 提供 TanStack Table + React Virtual 虚拟滚动集成
 * 专用于 MySQL 数据浏览，与其他模块完全独立实现
 *
 * 特性：
 * - 虚拟滚动：支持 100,000+ 行无卡顿
 * - 行展开：JSON 显示（展开行单独显示在表格下方）
 * - 单元格多选：保持现有的选中逻辑
 * - 固定行高：32px，简化虚拟滚动计算
 * - 列拖拽排序：支持通过拖拽表头重新排列列顺序
 * - 列宽管理：支持拖拽调整列宽，自动保存到 localStorage
 */

interface UseExcelTableProps {
  columns: string[];
  data: any[][];
  tableKey?: string; // 用于 localStorage 的唯一键，格式：database:table
}

interface UseExcelTableReturn {
  table: ReturnType<typeof useReactTable>;
  rowVirtualizer: ReturnType<typeof useVirtualizer>;
  virtualRows: VirtualItem[];
  rows: Row<any>[];
  tableContainerRef: React.RefObject<HTMLDivElement | null>;
  columnOrder: string[];
  columnWidths: Record<string, number>;
  setColumnOrder: (order: string[]) => void;
  setColumnWidth: (columnName: string, width: number) => void;
}

const ROW_HEIGHT = 40; // 与当前单元格 padding 的实际视觉行高对齐，减少中段滚动偏移抖动
const BUFFER_SIZE = 20; // 虚拟滚动缓冲区 - 增加到 20 以减少闪烁
const DEFAULT_COLUMN_WIDTH = 120; // 默认列宽（像素）
const MIN_COLUMN_WIDTH = 50; // 最小列宽
const MAX_COLUMN_WIDTH = 500; // 最大列宽

function areColumnsEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((item, index) => item === b[index]);
}

/**
 * 从 localStorage 加载列配置
 */
function loadColumnConfig(tableKey: string) {
  if (!tableKey) return { columnOrder: [], columnWidths: {} };
  try {
    const stored = localStorage.getItem(`excel-table-config:${tableKey}`);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error("Failed to load column config:", err);
  }
  return { columnOrder: [], columnWidths: {} };
}

/**
 * 保存列配置到 localStorage
 */
function saveColumnConfig(
  tableKey: string,
  columnOrder: string[],
  columnWidths: Record<string, number>
) {
  if (!tableKey) return;
  try {
    localStorage.setItem(
      `excel-table-config:${tableKey}`,
      JSON.stringify({ columnOrder, columnWidths })
    );
  } catch (err) {
    console.error("Failed to save column config:", err);
  }
}

export function useExcelTable({
  columns,
  data,
  tableKey,
}: UseExcelTableProps): UseExcelTableReturn {
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // 列顺序状态：初始化为列名数组
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const stored = loadColumnConfig(tableKey || "");
    return stored.columnOrder.length > 0 ? stored.columnOrder : columns;
  });

  // 列宽状态：初始化为空对象，表示使用默认宽度
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const stored = loadColumnConfig(tableKey || "");
    return stored.columnWidths || {};
  });

  // 当 columns 改变时，更新 columnOrder（但不覆盖已保存的顺序）
  useEffect(() => {
    setColumnOrder((prev) => {
      // 迁移后列可见性会频繁变化，这里保留已有顺序并仅增量合并，避免抖动和重排
      const retained = prev.filter((column) => columns.includes(column));
      const appended = columns.filter((column) => !retained.includes(column));
      const nextOrder = [...retained, ...appended];
      return areColumnsEqual(prev, nextOrder) ? prev : nextOrder;
    });
  }, [columns]);

  // 保存列配置到 localStorage
  useEffect(() => {
    if (tableKey) {
      saveColumnConfig(tableKey, columnOrder, columnWidths);
    }
  }, [tableKey, columnOrder, columnWidths]);

  // 根据 columnOrder 对列进行重新排序
  const orderedColumns = useMemo(() => {
    return columnOrder.filter((col) => columns.includes(col));
  }, [columnOrder, columns]);

  // 构建列定义：每列对应数据数组中的一个索引
  const columnDefs = useMemo<ColumnDef<any>[]>(() => {
    return orderedColumns.map((columnName) => ({
      id: `col-${columnName}`,
      header: columnName,
      accessorFn: (row: any) => {
        const originalIndex = columns.indexOf(columnName);
        return row[originalIndex];
      },
    }));
  }, [orderedColumns, columns]);

  // 构建行数据：转换为对象格式以兼容 TanStack Table
  const tableData = useMemo(() => {
    return data.map((rowData, rowIndex) => ({
      _rowIndex: rowIndex,
      ...Object.fromEntries(
        orderedColumns.map((col) => {
          const originalIndex = columns.indexOf(col);
          return [`col-${col}`, rowData[originalIndex]];
        })
      ),
    }));
  }, [data, columns, orderedColumns]);

  // expanded 状态必须稳定，避免触发 table 重新计算
  const expandedState = useMemo(() => ({}), []);

  // 创建 TanStack Table instance
  const table = useReactTable({
    data: tableData,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    state: {
      expanded: expandedState,
    },
  });

  // 获取所有行
  const rows = table.getRowModel().rows;

  // 虚拟滚动器（固定行高）
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current as any,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: (index) => rows[index]?.original?._rowIndex ?? index,
    overscan: BUFFER_SIZE,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  // 处理列宽更新
  const setColumnWidth = (columnName: string, width: number) => {
    const clampedWidth = Math.max(MIN_COLUMN_WIDTH, Math.min(width, MAX_COLUMN_WIDTH));
    setColumnWidths((prev) => ({
      ...prev,
      [columnName]: clampedWidth,
    }));
  };

  return {
    table,
    rowVirtualizer,
    virtualRows,
    rows,
    tableContainerRef,
    columnOrder,
    columnWidths,
    setColumnOrder,
    setColumnWidth,
  };
}


/**
 * 检查单元格是否被选中
 * 用于渲染时判断单元格的样式
 */
export function isCellSelected(
  rowIndex: number,
  columnIndex: number,
  selectedCellKeySet: Set<string>
): boolean {
  return selectedCellKeySet.has(`${rowIndex}:${columnIndex}`);
}

/**
 * 列管理常量和工具
 */
export { DEFAULT_COLUMN_WIDTH, MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH };

