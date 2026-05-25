import type { MouseEvent } from "react";
import type { MysqlFilterOperator } from "../../../types";
import type { ColumnType } from "../../../types/columnTypes";
import type { DataState, FilterGroupDraft, TableInfo } from "../utils";
import { DataTabPanel } from "./DataTabPanel";

export interface TableDataPaneProps {
  connectionId: string | null | undefined;
  selectedTableInfo: TableInfo | null;
  dataState: DataState;
  visibleDataColumns: string[];
  selectedCellKeySet: Set<string>;
  selectedRowIndex: number | null;
  filterPanelOpen: boolean;
  filterDraftTree: FilterGroupDraft | null;
  totalPages: number;
  filterOperators: Array<{ value: MysqlFilterOperator; label: string }>;
  columnTypes?: ColumnType[];
  columnTypeLabels?: string[];
  onSetFilterPanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  onSetFilterDraftTree: (
    tree: FilterGroupDraft | null | ((prev: FilterGroupDraft | null) => FilterGroupDraft | null)
  ) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onCellClick: (event: MouseEvent<HTMLTableCellElement>, rowIndex: number, columnIndex: number) => void;
  onRowContextMenu: (
    event: MouseEvent<HTMLTableCellElement>,
    rowIndex: number,
    column: string,
    cell: unknown
  ) => void;
  onSaveCell: (rowIndex: number, columnIndex: number, columnName: string, newValue: string) => Promise<void>;
  onClearFilter: () => void | Promise<void>;
  onApplyFilter: (tree: FilterGroupDraft | null) => void | Promise<void>;
}

export function TableDataPane({
  connectionId,
  selectedTableInfo,
  dataState,
  visibleDataColumns,
  selectedCellKeySet,
  selectedRowIndex,
  filterPanelOpen,
  filterDraftTree,
  totalPages,
  filterOperators,
  columnTypes,
  columnTypeLabels,
  onSetFilterPanelOpen,
  onSetFilterDraftTree,
  onPageChange,
  onPageSizeChange,
  onCellClick,
  onRowContextMenu,
  onSaveCell,
  onClearFilter,
  onApplyFilter,
}: TableDataPaneProps) {
  return (
    <DataTabPanel
      connectionId={connectionId}
      selectedTableInfo={selectedTableInfo}
      dataState={dataState}
      visibleDataColumns={visibleDataColumns}
      selectedCellKeySet={selectedCellKeySet}
      selectedRowIndex={selectedRowIndex}
      filterPanelOpen={filterPanelOpen}
      filterDraftTree={filterDraftTree}
      totalPages={totalPages}
      filterOperators={filterOperators}
      columnTypes={columnTypes}
      columnTypeLabels={columnTypeLabels}
      setFilterPanelOpen={onSetFilterPanelOpen}
      setFilterDraftTree={onSetFilterDraftTree}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      onCellClick={onCellClick}
      onRowContextMenu={onRowContextMenu}
      onSaveCell={onSaveCell}
      onClearFilter={onClearFilter}
      onApplyFilter={onApplyFilter}
    />
  );
}
