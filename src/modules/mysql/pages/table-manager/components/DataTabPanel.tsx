import { type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import type { MysqlFilterOperator, MysqlFilterNode } from "../../../../../state/MysqlContext";
import {
  type FilterGroupDraft,
  type TableInfo,
  type DataState,
  type SelectedCell,
  countFilterStats,
  updateFilterTreeNode,
  removeFilterTreeNode,
  createFilterCondition,
  createFilterGroup,
  operatorNeedsValue,
} from "../utils";
import { ExcelLikeTable } from "./ExcelLikeTable";

interface DataTabPanelProps {
  selectedTableInfo: TableInfo | null;
  dataState: DataState;
  visibleDataColumns: string[];
  selectedCells: SelectedCell[];
  selectedCellKeySet: Set<string>;
  expandedRow: number | null;
  selectedRowIndex: number | null;
  filterPanelOpen: boolean;
  filterDraftTree: FilterGroupDraft | null;
  columnMenuOpen: boolean;
  activeFilterTree: MysqlFilterNode | null;
  totalPages: number;
  filterOperators: Array<{ value: MysqlFilterOperator; label: string }>;

  // State setters
  setSelectedCells: (cells: SelectedCell[]) => void;
  setFilterPanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setFilterDraftTree: (tree: FilterGroupDraft | null | ((prev: FilterGroupDraft | null) => FilterGroupDraft | null)) => void;
  setColumnMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setExpandedRow: (index: number | null) => void;

  // Event handlers
  onAddNewRow: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onCellClick: (event: MouseEvent<HTMLTableCellElement>, rowIndex: number, columnIndex: number) => void;
  onRowContextMenu: (event: MouseEvent<HTMLTableCellElement>, rowIndex: number, column: string, cell: unknown) => void;
  onSaveCell: (rowIndex: number, columnIndex: number, columnName: string, newValue: string) => Promise<void>;
  onDeleteRow: (index: number) => void;
  onClearFilter: () => void;
  onClearSort: () => void;
  onApplyFilter: (tree: FilterGroupDraft | null) => void;
  onVisibleColumnToggle: (column: string, checked: boolean) => void;
  onSelectAllVisibleColumns: () => void;
  onFetchData: () => void;
  onBatchEditSelectedCells: (cells: SelectedCell[]) => void;
  onOpenSortModal: () => void;
}

export function DataTabPanel({
  selectedTableInfo,
  dataState,
  visibleDataColumns,
  selectedCells,
  selectedCellKeySet,
  expandedRow,
  selectedRowIndex,
  filterPanelOpen,
  filterDraftTree,
  columnMenuOpen,
  activeFilterTree,
  totalPages,
  filterOperators,
  // setSelectedCells is no longer used after removing selection summary bar
  setSelectedCells: _,
  setFilterPanelOpen,
  setFilterDraftTree,
  setColumnMenuOpen,
  setExpandedRow,
  onAddNewRow,
  onPageChange,
  onPageSizeChange,
  onCellClick,
  onRowContextMenu,
  onSaveCell,
  onDeleteRow,
  onClearFilter,
  onClearSort,
  onApplyFilter,
  onVisibleColumnToggle,
  onSelectAllVisibleColumns,
  onFetchData,
  onBatchEditSelectedCells,
  onOpenSortModal,
}: DataTabPanelProps) {
  const { t } = useTranslation();

  if (!selectedTableInfo) return null;

  const filterStats = countFilterStats(activeFilterTree as FilterGroupDraft | null);

  const renderFilterGroup = (group: FilterGroupDraft, isRoot = false, depth = 0) => (
    <div
      key={group.id}
      className={`tm-filter-group ${depth > 0 ? "is-nested" : ""}`}
      style={{ marginLeft: depth > 0 ? "16px" : 0 }}
    >
      <div className="tm-filter-group-header">
        <div className="tm-filter-group-title">
          <strong>{isRoot ? t("mysql.tableManager.rootGroup") : t("mysql.tableManager.nestedGroup")}</strong>
          <select
            className="form-control tm-filter-mode-select"
            value={group.mode}
            onChange={(event) =>
              setFilterDraftTree(
                (prev: FilterGroupDraft | null) =>
                  prev
                    ? (updateFilterTreeNode(
                        prev,
                        group.id,
                        (node: any) =>
                          node.kind === "group"
                            ? { ...node, mode: event.target.value as "and" | "or" }
                            : node
                      ) as FilterGroupDraft)
                    : prev
              )
            }
          >
            <option value="and">{t("mysql.tableManager.matchAll")}</option>
            <option value="or">{t("mysql.tableManager.matchAny")}</option>
          </select>
        </div>
        <div className="tm-filter-group-actions">
          <button
            className="btn btn-sm btn-ghost"
            onClick={() =>
              setFilterDraftTree(
                (prev: FilterGroupDraft | null) =>
                  prev
                    ? (updateFilterTreeNode(
                        prev,
                        group.id,
                        (node: any) =>
                          node.kind === "group"
                            ? {
                                ...node,
                                children: [...node.children, createFilterCondition(dataState.columns[0] ?? "")]
                              }
                            : node
                      ) as FilterGroupDraft)
                    : prev
              )
            }
          >
            {t("mysql.tableManager.addCondition")}
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() =>
              setFilterDraftTree(
                (prev: FilterGroupDraft | null) =>
                  prev
                    ? (updateFilterTreeNode(
                        prev,
                        group.id,
                        (node: any) =>
                          node.kind === "group"
                            ? {
                                ...node,
                                children: [
                                  ...node.children,
                                  createFilterGroup("and", [createFilterCondition(dataState.columns[0] ?? "")])
                                ]
                              }
                            : node
                      ) as FilterGroupDraft)
                    : prev
              )
            }
          >
            {t("mysql.tableManager.addGroup")}
          </button>
          {!isRoot && (
            <button
              className="btn btn-sm btn-ghost text-danger"
              onClick={() => setFilterDraftTree((prev: FilterGroupDraft | null) => (prev ? removeFilterTreeNode(prev, group.id) : prev))}
            >
              {t("mysql.tableManager.removeGroup")}
            </button>
          )}
        </div>
      </div>

      <div className="tm-filter-group-children">
        {group.children.length > 0 ? (
          group.children.map((child: any) => {
            if (child.kind === "group") {
              return renderFilterGroup(child, false, depth + 1);
            }

            return (
              <div key={child.id} className="tm-filter-row">
                <select
                  className="form-control"
                  value={child.column}
                  onChange={(event) =>
                    setFilterDraftTree(
                      (prev: FilterGroupDraft | null) =>
                        prev
                          ? (updateFilterTreeNode(
                              prev,
                              child.id,
                              (node: any) =>
                                node.kind === "condition"
                                  ? { ...node, column: event.target.value }
                                  : node
                            ) as FilterGroupDraft)
                          : prev
                    )
                  }
                >
                  {dataState.columns.map((column: string) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
                <select
                  className="form-control"
                  value={child.operator}
                  onChange={(event) =>
                    setFilterDraftTree(
                      (prev: FilterGroupDraft | null) =>
                        prev
                          ? (updateFilterTreeNode(
                              prev,
                              child.id,
                              (node: any) =>
                                node.kind === "condition"
                                  ? {
                                      ...node,
                                      operator: event.target.value as MysqlFilterOperator,
                                      value: operatorNeedsValue(event.target.value as MysqlFilterOperator)
                                        ? node.value ?? ""
                                        : ""
                                    }
                                  : node
                            ) as FilterGroupDraft)
                          : prev
                    )
                  }
                >
                  {filterOperators.map((operator) => (
                    <option key={operator.value} value={operator.value}>
                      {operator.label}
                    </option>
                  ))}
                </select>
                <input
                  className="form-control"
                  value={child.value ?? ""}
                  disabled={!operatorNeedsValue(child.operator)}
                  placeholder={
                    operatorNeedsValue(child.operator)
                      ? t("mysql.tableManager.filterValue")
                      : t("mysql.tableManager.noValueNeeded")
                  }
                  onChange={(event) =>
                    setFilterDraftTree(
                      (prev: FilterGroupDraft | null) =>
                        prev
                          ? (updateFilterTreeNode(
                              prev,
                              child.id,
                              (node: any) =>
                                node.kind === "condition"
                                  ? { ...node, value: event.target.value }
                                  : node
                            ) as FilterGroupDraft)
                          : prev
                    )
                  }
                />
                <button
                  className="btn btn-sm btn-ghost text-danger"
                  onClick={() => setFilterDraftTree((prev: FilterGroupDraft | null) => (prev ? removeFilterTreeNode(prev, child.id) : prev))}
                >
                  {t("mysql.tableManager.removeCondition")}
                </button>
              </div>
            );
          })
        ) : (
          <div className="muted tm-filter-empty">{t("mysql.tableManager.emptyGroup")}</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="tm-filter-workspace">
      <div className="tm-toolbar">
        <div className="tm-toolbar-meta">
          <span className="tm-toolbar-stat">
            {filterStats.conditions > 0
              ? t("mysql.tableManager.filterSummary", {
                  count: filterStats.conditions,
                  groups: filterStats.groups,
                  mode: (activeFilterTree as any)?.mode === "or" ? t("mysql.tableManager.matchAny") : t("mysql.tableManager.matchAll")
                })
              : t("mysql.tableManager.noFilterApplied")}
            {filterStats.conditions > 0 && (
              <button className="btn btn-sm btn-ghost" onClick={onClearFilter}>
                {t("common.close")}
              </button>
            )}
          </span>
          <span className="tm-toolbar-stat">
            {(selectedTableInfo as any)?.sortColumn
              ? t("mysql.tableManager.sortSummary", {
                  column: (selectedTableInfo as any)?.sortColumn,
                  direction:
                    (selectedTableInfo as any)?.sortDirection === "desc"
                      ? t("dataBrowser.sortDescending")
                      : t("dataBrowser.sortAscending")
                })
              : t("mysql.tableManager.noSortApplied")}
            {(selectedTableInfo as any)?.sortColumn && (
              <button className="btn btn-sm btn-ghost" onClick={onClearSort}>
                {t("common.close")}
              </button>
            )}
          </span>
        </div>
        <div className="tm-toolbar-actions">
          <button className="btn btn-sm btn-ghost" onClick={onAddNewRow}>
            {t("mysql.tableManager.addNewRow")}
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => {
              const firstColumn = dataState.columns[0] ?? "";
              const tree = filterDraftTree
                ? filterDraftTree
                : createFilterGroup("and", [createFilterCondition(firstColumn)]);
              setFilterDraftTree(tree);
              setFilterPanelOpen(!filterPanelOpen);
            }}
          >
            {t("mysql.tableManager.filterData")}
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={onOpenSortModal}
          >
            {t("mysql.tableManager.sortData")}
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => setColumnMenuOpen(!columnMenuOpen)}
          >
            {t("mysql.tableManager.displayColumns")}
          </button>
          {selectedCells.length > 0 && (
            <button className="btn btn-sm btn-ghost" onClick={() => onBatchEditSelectedCells(selectedCells)}>
              {t("mysql.tableManager.batchEditSelectedCells")}
            </button>
          )}
          <button
            className="btn btn-sm btn-ghost"
            onClick={onFetchData}
            disabled={dataState.loading}
          >
            {dataState.loading ? t("common.loading") : t("common.refresh")}
          </button>

          {/* Column selection dropdown menu */}
          {columnMenuOpen && dataState.columns.length > 0 && (
            <div className="tm-column-menu">
              <div className="tm-column-menu-body">
                <div className="tm-column-menu-tools">
                  <button className="btn btn-sm btn-ghost" onClick={onSelectAllVisibleColumns}>
                    {t("common.selectAll")}
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => setColumnMenuOpen(false)}
                  >
                    {t("common.close")}
                  </button>
                </div>
                {dataState.columns.map((column: string) => {
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
          )}
        </div>
      </div>

      {filterPanelOpen && (
        <div className="tm-filter-panel">
          <div className="page-section-header">
            <div className="tm-inline-checkbox">
              <strong>{t("mysql.tableManager.filterPanelTitle")}</strong>
            </div>
            <div className="flex-gap">
              <button className="btn btn-sm btn-ghost" onClick={() => setFilterPanelOpen(false)}>
                {t("common.close")}
              </button>
              <button className="btn btn-sm btn-ghost" onClick={onClearFilter}>
                {t("mysql.tableManager.clearFilter")}
              </button>
              <button className="btn btn-sm btn-primary" onClick={() => onApplyFilter(filterDraftTree)}>
                {t("common.save")}
              </button>
            </div>
          </div>
          {filterDraftTree ? renderFilterGroup(filterDraftTree, true, 0) : null}
        </div>
      )}

      {/* Data error */}
      {dataState.error && (
        <div className="text-danger tm-inline-error">
          {dataState.error}
        </div>
      )}

      {/* Data table - 使用新的 ExcelLikeTable 组件 */}
      <ExcelLikeTable
        columns={visibleDataColumns}
        data={dataState.rows}
        selectedCellKeySet={selectedCellKeySet}
        expandedRow={expandedRow}
        selectedRowIndex={selectedRowIndex}
        pageSize={dataState.pageSize}
        pageNumber={dataState.page}
        loading={dataState.loading}
        tableKey={selectedTableInfo ? `${selectedTableInfo.database}:${selectedTableInfo.table}` : undefined}
        onCellClick={onCellClick}
        onRowContextMenu={onRowContextMenu}
        onSaveCell={onSaveCell}
        onDeleteRow={onDeleteRow}
        onExpandedRowChange={setExpandedRow}
      />

      <div className="tm-pagination">
        <div className="tm-pagination-group">
          <span>{t("dataBrowser.pageSize")}:</span>
          <select
            className="form-control tm-page-size-select"
            value={dataState.pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {[50, 100, 200, 500].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        <div className="tm-pagination-group">
          <button
            className="btn btn-sm btn-ghost"
            disabled={dataState.page <= 1}
            onClick={() => onPageChange(dataState.page - 1)}
          >
            {t("dataBrowser.previousPage")}
          </button>
          <span>
            {dataState.page} / {totalPages}
          </span>
          <button
            className="btn btn-sm btn-ghost"
            disabled={dataState.page >= totalPages}
            onClick={() => onPageChange(dataState.page + 1)}
          >
            {t("dataBrowser.nextPage")}
          </button>
        </div>
      </div>
    </div>
  );
}
