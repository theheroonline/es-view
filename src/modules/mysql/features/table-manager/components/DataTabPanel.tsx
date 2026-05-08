import { type MouseEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MysqlFilterOperator } from "../../../types";
import {
    type DataState,
    type FilterConditionDraft,
    type FilterGroupDraft,
    type TableInfo,
    createFilterCondition,
    createFilterGroup,
    joinBetweenValue,
    operatorNeedsValue,
    splitBetweenValue,
} from "../utils";
import { ExcelLikeTable } from "./ExcelLikeTable";

interface DataTabPanelProps {
  selectedTableInfo: TableInfo | null;
  dataState: DataState;
  visibleDataColumns: string[];
  selectedCellKeySet: Set<string>;
  selectedRowIndex: number | null;
  filterPanelOpen: boolean;
  filterDraftTree: FilterGroupDraft | null;
  totalPages: number;
  filterOperators: Array<{ value: MysqlFilterOperator; label: string }>;

  setFilterPanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setFilterDraftTree: (tree: FilterGroupDraft | null | ((prev: FilterGroupDraft | null) => FilterGroupDraft | null)) => void;

  // Event handlers
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onCellClick: (event: MouseEvent<HTMLTableCellElement>, rowIndex: number, columnIndex: number) => void;
  onRowContextMenu: (event: MouseEvent<HTMLTableCellElement>, rowIndex: number, column: string, cell: unknown) => void;
  onSaveCell: (rowIndex: number, columnIndex: number, columnName: string, newValue: string) => Promise<void>;
  onClearFilter: () => void;
  onApplyFilter: (tree: FilterGroupDraft | null) => void;
}

export function DataTabPanel({
  selectedTableInfo,
  dataState,
  visibleDataColumns,
  selectedCellKeySet,
  selectedRowIndex,
  filterPanelOpen,
  filterDraftTree,
  totalPages,
  filterOperators,
  setFilterPanelOpen,
  setFilterDraftTree,
  onPageChange,
  onPageSizeChange,
  onCellClick,
  onRowContextMenu,
  onSaveCell,
  onClearFilter,
  onApplyFilter,
}: DataTabPanelProps) {
  const { t } = useTranslation();

  // 本地状态用于管理输入框值（避免每次输入都刷新数据）
  const [pageSizeInput, setPageSizeInput] = useState(String(dataState.pageSize));
  const [pageInput, setPageInput] = useState(String(dataState.page));

  // 当外部数据改变时，同步输入框值
  useEffect(() => {
    setPageSizeInput(String(dataState.pageSize));
  }, [dataState.pageSize]);

  useEffect(() => {
    setPageInput(String(dataState.page));
  }, [dataState.page]);

  useEffect(() => {
    if (!filterPanelOpen || !filterDraftTree) return;

    const flattenConditions = (node: FilterGroupDraft): FilterConditionDraft[] =>
      node.children.flatMap((child) => {
        if (child.kind === "condition") {
          return [child];
        }
        return flattenConditions(child);
      });

    const hasNestedGroup = filterDraftTree.children.some((child) => child.kind === "group");
    if (!hasNestedGroup) return;

    const flattened = flattenConditions(filterDraftTree);
    setFilterDraftTree({
      ...filterDraftTree,
      children: flattened.length > 0 ? flattened : [createFilterCondition(dataState.columns[0] ?? "")],
    });
  }, [dataState.columns, filterDraftTree, filterPanelOpen, setFilterDraftTree]);

  const clampPage = (value: number) => Math.min(totalPages, Math.max(1, value));
  const currentPageCount = dataState.rows.length;
  const selectedRowDisplay =
    selectedRowIndex !== null && selectedRowIndex >= 0 && selectedRowIndex < currentPageCount
      ? selectedRowIndex + 1
      : null;

  if (!selectedTableInfo) return null;

  const rootFilterTree = filterDraftTree ?? createFilterGroup("and", [createFilterCondition(dataState.columns[0] ?? "")]);
  const filterConditions = rootFilterTree.children.filter(
    (child): child is FilterConditionDraft => child.kind === "condition"
  );

  const updateCondition = (id: string, updater: (condition: FilterConditionDraft) => FilterConditionDraft) => {
    setFilterDraftTree((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        children: prev.children.map((child) => {
          if (child.kind !== "condition" || child.id !== id) return child;
          return updater(child);
        }),
      };
    });
  };

  const removeCondition = (id: string) => {
    setFilterDraftTree((prev) => {
      if (!prev) return prev;
      const conditions = prev.children.filter((child) => child.kind === "condition" && child.id !== id);
      return {
        ...prev,
        children: conditions.length > 0 ? conditions : [createFilterCondition(dataState.columns[0] ?? "")],
      };
    });
  };

  const renderValueInput = (condition: FilterConditionDraft) => {
    if (!operatorNeedsValue(condition.operator)) {
      return (
        <input
          className="form-control"
          value=""
          disabled
          placeholder={t("mysql.tableManager.noValueNeeded")}
          readOnly
        />
      );
    }

    if (condition.operator === "between") {
      const [startValue, endValue] = splitBetweenValue(condition.value ?? "");
      return (
        <div className="tm-filter-between-inputs">
          <input
            className="form-control"
            value={startValue}
            placeholder={t("mysql.tableManager.filterValue")}
            onChange={(event) =>
              updateCondition(condition.id, (prev) => ({
                ...prev,
                value: joinBetweenValue(event.target.value, splitBetweenValue(prev.value ?? "")[1]),
              }))
            }
          />
          <span className="tm-filter-between-separator">~</span>
          <input
            className="form-control"
            value={endValue}
            placeholder={t("mysql.tableManager.filterValue")}
            onChange={(event) =>
              updateCondition(condition.id, (prev) => ({
                ...prev,
                value: joinBetweenValue(splitBetweenValue(prev.value ?? "")[0], event.target.value),
              }))
            }
          />
        </div>
      );
    }

    return (
      <input
        className="form-control"
        value={condition.value ?? ""}
        placeholder={t("mysql.tableManager.filterValue")}
        onChange={(event) => updateCondition(condition.id, (prev) => ({ ...prev, value: event.target.value }))}
      />
    );
  };

  return (
    <div className="tm-filter-workspace">
      {filterPanelOpen && (
        <div className="tm-filter-panel">
          <div className="tm-filter-lite-head">
            <strong>{t("mysql.tableManager.filterPanelTitle")}</strong>
            <div className="tm-filter-lite-head-actions">
              <label className="tm-filter-lite-mode">
                <span>{t("mysql.tableManager.matchMode")}</span>
                <select
                  className="form-control"
                  value={rootFilterTree.mode}
                  onChange={(event) =>
                    setFilterDraftTree((prev) => (prev ? { ...prev, mode: event.target.value as "and" | "or" } : prev))
                  }
                >
                  <option value="and">{t("mysql.tableManager.matchAll")}</option>
                  <option value="or">{t("mysql.tableManager.matchAny")}</option>
                </select>
              </label>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() =>
                  setFilterDraftTree((prev) => {
                    const next = prev ?? createFilterGroup("and", []);
                    return {
                      ...next,
                      children: [...next.children.filter((child) => child.kind === "condition"), createFilterCondition(dataState.columns[0] ?? "")],
                    };
                  })
                }
              >
                {t("mysql.tableManager.addCondition")}
              </button>
              <button className="btn btn-sm btn-ghost" onClick={onClearFilter}>
                {t("mysql.tableManager.clearFilter")}
              </button>
              <button className="btn btn-sm btn-primary" onClick={() => onApplyFilter(rootFilterTree)}>
                {t("mysql.tableManager.apply")}
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => setFilterPanelOpen(false)}>
                {t("common.close")}
              </button>
            </div>
          </div>

          <div className="tm-filter-lite-list">
            {filterConditions.map((condition, index) => (
              <div key={condition.id} className="tm-filter-lite-row">
                <span className="tm-filter-lite-joiner">{index === 0 ? "" : rootFilterTree.mode.toUpperCase()}</span>
                <select
                  className="form-control"
                  value={condition.column}
                  onChange={(event) => updateCondition(condition.id, (prev) => ({ ...prev, column: event.target.value }))}
                >
                  {dataState.columns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
                <select
                  className="form-control"
                  value={condition.operator}
                  onChange={(event) =>
                    updateCondition(condition.id, (prev) => ({
                      ...prev,
                      operator: event.target.value as MysqlFilterOperator,
                      value: operatorNeedsValue(event.target.value as MysqlFilterOperator) ? prev.value ?? "" : "",
                    }))
                  }
                >
                  {filterOperators.map((operator) => (
                    <option key={operator.value} value={operator.value}>
                      {operator.label}
                    </option>
                  ))}
                </select>
                {renderValueInput(condition)}
                <button className="btn btn-sm btn-ghost text-danger" onClick={() => removeCondition(condition.id)}>
                  {t("mysql.tableManager.removeCondition")}
                </button>
              </div>
            ))}
          </div>
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
        key={selectedTableInfo ? `${selectedTableInfo.database}:${selectedTableInfo.table}` : undefined}
        columns={visibleDataColumns}
        data={dataState.rows}
        selectedCellKeySet={selectedCellKeySet}
        selectedRowIndex={selectedRowIndex}
        loading={dataState.loading}
        tableKey={selectedTableInfo ? `${selectedTableInfo.database}:${selectedTableInfo.table}` : undefined}
        onCellClick={onCellClick}
        onRowContextMenu={onRowContextMenu}
        onSaveCell={onSaveCell}
      />

      <div className="tm-pagination">
        <div className="tm-pagination-group">
          <span>{t("dataBrowser.pageSize")}:</span>
          <input
            type="number"
            className="tm-page-size-input"
            value={pageSizeInput}
            onChange={(e) => setPageSizeInput(e.target.value)}
            onBlur={(e) => {
              const val = Number(e.target.value);
              if (val > 0 && val <= 1000) {
                onPageSizeChange(val);
              } else {
                // 无效输入，恢复原值
                setPageSizeInput(String(dataState.pageSize));
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const val = Number(pageSizeInput);
                if (val > 0 && val <= 1000) {
                  onPageSizeChange(val);
                } else {
                  setPageSizeInput(String(dataState.pageSize));
                }
              }
            }}
            min="1"
            max="1000"
          />
        </div>
        <div className="tm-pagination-group">
          <button
            className="btn btn-sm btn-ghost"
            disabled={dataState.page <= 1}
            onClick={() => onPageChange(1)}
          >
            {t("mysql.tableManager.firstPage")}
          </button>
          <button
            className="btn btn-sm btn-ghost"
            disabled={dataState.page <= 1}
            onClick={() => onPageChange(dataState.page - 1)}
          >
            {t("dataBrowser.previousPage")}
          </button>
          <span className="tm-pagination-info">
            <input
              type="number"
              className="tm-page-input"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={(e) => {
                const val = Number(e.target.value);
                if (!Number.isFinite(val)) {
                  setPageInput(String(dataState.page));
                  return;
                }

                const clamped = clampPage(val);
                onPageChange(clamped);
                setPageInput(String(clamped));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = Number(pageInput);
                  if (!Number.isFinite(val)) {
                    setPageInput(String(dataState.page));
                    return;
                  }

                  const clamped = clampPage(val);
                  onPageChange(clamped);
                  setPageInput(String(clamped));
                }
              }}
              min="1"
              max={totalPages}
            />
            <span>/</span>
            <span>{totalPages}</span>
          </span>
          <button
            className="btn btn-sm btn-ghost"
            disabled={dataState.page >= totalPages}
            onClick={() => onPageChange(dataState.page + 1)}
          >
            {t("dataBrowser.nextPage")}
          </button>
          <button
            className="btn btn-sm btn-ghost"
            disabled={dataState.page >= totalPages}
            onClick={() => onPageChange(totalPages)}
          >
            {t("mysql.tableManager.lastPage")}
          </button>
        </div>
        <div className="tm-pagination-group tm-pagination-group-right">
          {selectedRowDisplay !== null ? (
            <span className="tm-pagination-info">
              {selectedRowDisplay}/{Math.max(currentPageCount, 1)}
            </span>
          ) : null}
          <span className="tm-pagination-info">{t("mysql.tableManager.currentPageRows", { count: currentPageCount })}</span>
        </div>
      </div>
    </div>
  );
}
