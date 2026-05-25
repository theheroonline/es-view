import {
    getCoreRowModel,
    getExpandedRowModel,
    useReactTable,
    type ColumnDef,
    type Row,
} from "@tanstack/react-table";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
 * - 固定行高：40px，简化虚拟滚动计算
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
  theadRef: React.RefObject<HTMLTableSectionElement | null>;
  columnOrder: string[];
  columnWidths: Record<string, number>;
  setColumnOrder: (order: string[]) => void;
  setColumnWidth: (columnName: string, width: number, isFinal?: boolean) => void;
}

const ROW_HEIGHT = 32; // 紧凑行高：32px，提高同屏行数
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

// Module-level cache: survives HMR and component remounts
const columnOrderCache = new Map<string, string[]>();
const columnWidthsCache = new Map<string, Record<string, number>>();
const scrollTopCache = new Map<string, number>();

export function useExcelTable({
  columns,
  data,
  tableKey,
}: UseExcelTableProps): UseExcelTableReturn {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const theadRef = useRef<HTMLTableSectionElement>(null);

  // Track the previous tableKey to detect table switches
  const prevTableKeyRef = useRef<string | undefined>(undefined);

  // Use a ref to hold column order so we can read the latest value
  // in event handlers without stale closure captures.
  const initColumnOrder = (() => {
    const stored = loadColumnConfig(tableKey || "");
    const fromCache = columnOrderCache.get(tableKey || "");
    if (fromCache && fromCache.length > 0) return fromCache;
    if (stored.columnOrder.length > 0) return stored.columnOrder;
    return columns;
  })();
  const columnOrderRef = useRef<string[]>(initColumnOrder);

  const initColumnWidths = (() => {
    const stored = loadColumnConfig(tableKey || "");
    const fromCache = columnWidthsCache.get(tableKey || "");
    if (fromCache && Object.keys(fromCache).length > 0) return fromCache;
    return stored.columnWidths || {};
  })();
  const columnWidthsRef = useRef<Record<string, number>>(initColumnWidths);

  // Track previous columns per instance to detect actual prop changes.
  // On mount, we initialize with the current columns so the sync block
  // does NOT trigger on the first render — it should only react to
  // actual column prop changes (e.g., visibleColumns toggled by user).
  const prevColumnsRef = useRef<string[]>(columns);

  // Track previous tableKey to detect table switches. When switching tables,
  // the column order must reset to the new table's natural order (not inherit
  // the old table's user-customized order).
  if (prevTableKeyRef.current !== tableKey) {
    prevTableKeyRef.current = tableKey;
    // Load the stored order for this specific table
    const stored = loadColumnConfig(tableKey || "");
    const fromCache = columnOrderCache.get(tableKey || "");
    const nextOrder = (fromCache && fromCache.length > 0)
      ? fromCache
      : (stored.columnOrder.length > 0 ? stored.columnOrder : columns);
    if (!areColumnsEqual(columnOrderRef.current, nextOrder)) {
      columnOrderRef.current = nextOrder;
    }
  }

  // Sync columnOrderRef with columns prop when the columns actually change.
  // Preserves user reorder for columns that still exist, appends new ones.
  if (!areColumnsEqual(columns, prevColumnsRef.current)) {
    prevColumnsRef.current = columns;
    const prev = columnOrderRef.current;
    const retained = prev.filter((column) => columns.includes(column));
    const appended = columns.filter((column) => !retained.includes(column));
    const nextOrder = [...retained, ...appended];
    if (!areColumnsEqual(columnOrderRef.current, nextOrder)) {
      columnOrderRef.current = nextOrder;
    }
  }

  // Stable state for triggering re-renders on drag reorders and persistence.
  const [columnOrder, setColumnOrderState] = useState<string[]>(columnOrderRef.current);
  const [columnWidths, setColumnWidthsState] = useState<Record<string, number>>(columnWidthsRef.current);

  // Sync state with refs on every render to keep them in lockstep.
  if (!areColumnsEqual(columnOrder, columnOrderRef.current)) {
    setColumnOrderState(columnOrderRef.current);
  }
  if (JSON.stringify(columnWidths) !== JSON.stringify(columnWidthsRef.current)) {
    setColumnWidthsState(columnWidthsRef.current);
  }

  // Persist to localStorage when column order or widths change.
  useEffect(() => {
    if (tableKey) {
      columnOrderCache.set(tableKey, columnOrder);
      columnWidthsCache.set(tableKey, columnWidths);
      saveColumnConfig(tableKey, columnOrder, columnWidths);
    }
  }, [tableKey, columnOrder, columnWidths]);

  const setColumnOrder = useCallback((order: string[]) => {
    columnOrderRef.current = order;
    setColumnOrderState(order);
  }, []);

  // 根据 columnOrder 对列进行重新排序
  const orderedColumns = useMemo(() => {
    return columnOrderRef.current.filter((col) => columns.includes(col));
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

  // ─── Scroll position persistence per table ───
  // Must restore scrollTop AFTER the virtualizer has finished reconfiguring to the
  // new data (count, rows, getItemKey). useLayoutEffect is too early — the virtualizer's
  // internal effects reset scroll state when count changes, overwriting our restoration.
  // We use requestAnimationFrame so the restoration runs after all effects and after the
  // virtualizer has recalculated its virtual window for the new data.

  const currentTableKeyRef = useRef(tableKey);
  currentTableKeyRef.current = tableKey;
  const rowVirtualizerRef = useRef(rowVirtualizer);
  rowVirtualizerRef.current = rowVirtualizer;

  // Stable scroll listener — stays alive across tableKey changes.
  // Use capture phase to ensure we catch the scroll event before anything else.
  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;

    // Verify this element is actually scrollable
    const isScrollable = el.scrollHeight > el.clientHeight;
    void isScrollable;

    const handleScroll = () => {
      if (currentTableKeyRef.current) {
        scrollTopCache.set(currentTableKeyRef.current, el.scrollTop);
      }
    };

    // Try capture phase first to verify the event reaches this element
    el.addEventListener("scroll", handleScroll, { passive: true, capture: true });
    return () => {
      el.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, []);

  // Restore scrollTop when tableKey changes — relies on scroll listener (above)
  // to keep scrollTopCache up-to-date in real time.
  // Do NOT attempt to save the old table's scrollTop here — by the time this
  // effect runs, the virtualizer has already reset el.scrollTop to 0, which would
  // overwrite the correct cached value from the scroll listener.
  useEffect(() => {
    if (!tableKey) return;

    const cached = scrollTopCache.get(tableKey);
    if (cached !== undefined && cached > 0) {
      requestAnimationFrame(() => {
        rowVirtualizerRef.current.scrollToOffset(cached, { align: "start" });
      });
    }

    prevTableKeyRef.current = tableKey;
  }, [tableKey]);

  // 处理列宽更新 — 拖拽中仅操作 DOM（零重渲染），松开时提交状态并持久化
  const setColumnWidth = (columnName: string, width: number, isFinal = false) => {
    const clampedWidth = Math.max(MIN_COLUMN_WIDTH, Math.min(width, MAX_COLUMN_WIDTH));

    if (!isFinal) {
      // 拖拽中：直接修改 DOM，不触发 React 重渲染
      const thead = theadRef.current;
      if (!thead) return;

      const selector = `th[data-column="${CSS.escape(columnName)}"], td[data-column="${CSS.escape(columnName)}"]`;
      const cells = thead.parentElement?.querySelectorAll(selector) || [];
      for (const cell of cells as NodeListOf<HTMLElement>) {
        cell.style.width = `${clampedWidth}px`;
      }
      return;
    }

    // 拖拽结束：提交到 ref + state，触发持久化
    const prev = columnWidthsRef.current;
    if ((prev[columnName] ?? DEFAULT_COLUMN_WIDTH) === clampedWidth) {
      return;
    }
    columnWidthsRef.current = { ...prev, [columnName]: clampedWidth };
    setColumnWidthsState(columnWidthsRef.current);
  };

  return {
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

