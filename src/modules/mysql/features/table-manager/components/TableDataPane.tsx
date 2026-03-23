import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import type { MysqlFilterOperator } from "../../../types";
import type { DataState, FilterGroupDraft, TableInfo } from "../utils";
import { DataTabPanel } from "./DataTabPanel";

export interface TableDataPaneProps {
  selectedTableInfo: TableInfo | null;
  dataState: DataState;
  visibleDataColumns: string[];
  selectedCellKeySet: Set<string>;
  selectedRowIndex: number | null;
  filterPanelOpen: boolean;
  filterDraftTree: FilterGroupDraft | null;
  totalPages: number;
  filterOperators: Array<{ value: MysqlFilterOperator; label: string }>;
  columnMenuOpen: boolean;
  onSetColumnMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  onVisibleColumnToggle: (column: string, checked: boolean) => void;
  onSelectAllVisibleColumns: () => void;
  onAddNewRow: () => void;
  onToggleFilterPanel: () => void;
  onOpenSortModal: () => void;
  onRefreshData: () => void | Promise<void>;
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
  selectedTableInfo,
  dataState,
  visibleDataColumns,
  selectedCellKeySet,
  selectedRowIndex,
  filterPanelOpen,
  filterDraftTree,
  totalPages,
  filterOperators,
  columnMenuOpen,
  onSetColumnMenuOpen,
  onVisibleColumnToggle,
  onSelectAllVisibleColumns,
  onAddNewRow,
  onToggleFilterPanel,
  onOpenSortModal,
  onRefreshData,
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
  const { t } = useTranslation();

  return (
    <>
      <div className="tm-data-actions-wrap">
        <button className="btn btn-sm btn-ghost" onClick={onAddNewRow}>
          {t("mysql.tableManager.addNewRow")}
        </button>
        <button className="btn btn-sm btn-ghost" onClick={onToggleFilterPanel}>
          {t("mysql.tableManager.filterData")}
        </button>
        <button className="btn btn-sm btn-ghost" onClick={onOpenSortModal}>
          {t("mysql.tableManager.sortData")}
        </button>
        <button className="btn btn-sm btn-ghost" onClick={() => onSetColumnMenuOpen((prev) => !prev)}>
          {t("mysql.tableManager.displayColumns")}
        </button>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => {
            void onRefreshData();
          }}
          disabled={dataState.loading}
        >
          {dataState.loading ? t("common.loading") : t("common.refresh")}
        </button>

        {columnMenuOpen && dataState.columns.length > 0 ? (
          <div className="tm-column-menu">
            <div className="tm-column-menu-body">
              <div className="tm-column-menu-tools">
                <button className="btn btn-sm btn-ghost" onClick={onSelectAllVisibleColumns}>
                  {t("common.selectAll")}
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => onSetColumnMenuOpen(false)}>
                  {t("common.close")}
                </button>
              </div>
              {dataState.columns.map((column) => {
                const checked = visibleDataColumns.includes(column);
                return (
                  <label key={column} className={`tm-column-option ${checked ? "is-checked" : ""}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => onVisibleColumnToggle(column, event.target.checked)}
                    />
                    {column}
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <DataTabPanel
        selectedTableInfo={selectedTableInfo}
        dataState={dataState}
        visibleDataColumns={visibleDataColumns}
        selectedCellKeySet={selectedCellKeySet}
        selectedRowIndex={selectedRowIndex}
        filterPanelOpen={filterPanelOpen}
        filterDraftTree={filterDraftTree}
        totalPages={totalPages}
        filterOperators={filterOperators}
        setFilterPanelOpen={onSetFilterPanelOpen}
        setFilterDraftTree={onSetFilterDraftTree}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        onCellClick={onCellClick}
        onRowContextMenu={onRowContextMenu}
        onSaveCell={onSaveCell}
        onClearFilter={() => {
          void onClearFilter();
        }}
        onApplyFilter={(tree) => {
          void onApplyFilter(tree);
        }}
      />
    </>
  );
}