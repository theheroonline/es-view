import { useMemo, useRef, useState, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  type ColumnDef,
  type Row,
} from "@tanstack/react-table";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";

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
  expandedRow: number | null;
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

const ROW_HEIGHT = 32; // 固定行高
const BUFFER_SIZE = 20; // 虚拟滚动缓冲区 - 增加到 20 以减少闪烁
const DEFAULT_COLUMN_WIDTH = 120; // 默认列宽（像素）
const MIN_COLUMN_WIDTH = 50; // 最小列宽
const MAX_COLUMN_WIDTH = 500; // 最大列宽

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
  expandedRow,
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
      // 如果 columns 内容改变，需要重新初始化
      if (prev.length !== columns.length || !columns.every((c, i) => c === prev[i])) {
        return columns;
      }
      return prev;
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

  // 创建 TanStack Table instance
  const table = useReactTable({
    data: tableData,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    state: {
      expanded: expandedRow !== null ? { [expandedRow]: true } : {},
    },
  });

  // 获取所有行
  const rows = table.getRowModel().rows;

  // 虚拟滚动器
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current as any,
    estimateSize: () => ROW_HEIGHT,
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
 * 渲染 JSON 展开行
 * 用于显示完整的行数据
 */
export function renderExpandedRowJSON(
  rowData: any,
  columns: string[]
): string {
  try {
    const json = Object.fromEntries(
      columns.map((col, idx) => [col, rowData[idx]])
    );
    return JSON.stringify(json, null, 2);
  } catch {
    return "Error rendering row data";
  }
}

/**
 * 列管理常量和工具
 */
export { DEFAULT_COLUMN_WIDTH, MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH };
