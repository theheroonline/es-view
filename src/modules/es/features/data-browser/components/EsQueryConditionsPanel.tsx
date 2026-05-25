import { DatePicker } from "antd";
import type { Dayjs } from "dayjs";
import type { TFunction } from "i18next";
import { useCallback, useMemo } from "react";
import type { BoolType, ConditionItem, SortDirection } from "../types";

const { RangePicker } = DatePicker;

interface EsQueryConditionsPanelProps {
  conditions: ConditionItem[];
  fields: string[];
  i18nLanguage: string;
  presets: Array<{ label: string; value: [Dayjs, Dayjs] }>;
  showQueryConditions: boolean;
  t: TFunction;
  onAddCondition: (index?: number) => void;
  onChangeCondition: (index: number, next: Partial<ConditionItem>) => void;
  onClose: () => void;
  onRemoveCondition: (index: number) => void;
  onToggleCondition: (index: number) => void;
}

export function EsQueryConditionsPanel({
  conditions,
  fields,
  i18nLanguage,
  presets,
  showQueryConditions,
  t,
  onAddCondition,
  onChangeCondition,
  onClose,
  onRemoveCondition,
  onToggleCondition,
}: EsQueryConditionsPanelProps) {
  if (!showQueryConditions) {
    return null;
  }

  // 为每个条件分配稳定的唯一 ID，基于条件内容生成，避免索引 key 导致 React 状态错乱
  const conditionIds = useMemo(() => {
    return conditions.map((item, idx) =>
      `${item.boolType}-${item.field}-${item.operator}-${idx}`
    );
  }, [conditions]);

  const renderCondition = useCallback((item: ConditionItem, idx: number) => {
    const condId = conditionIds[idx] ?? `cond-fallback-${idx}`;
    return (
      <div key={condId} className={`query-row ${item.enabled ? "" : "disabled"}`}>
        <div className="logic-group">
          <label className="switch">
            <input
              type="checkbox"
              checked={item.enabled}
              onChange={() => onToggleCondition(idx)}
            />
            <span className="slider"></span>
          </label>
          <select
            className="form-control"
            style={{ width: "70px", padding: "2px 6px", fontSize: "12px", height: "28px" }}
            value={item.boolType}
            onChange={(event) => onChangeCondition(idx, { boolType: event.target.value as BoolType })}
          >
            <option value="must">{t("dataBrowser.must")}</option>
            <option value="should">{t("dataBrowser.should")}</option>
            <option value="must_not">{t("dataBrowser.mustNot")}</option>
            <option value="sort">{t("dataBrowser.sort")}</option>
          </select>
        </div>

        <div>
          <select
            className="form-control"
            value={item.field}
            onChange={(event) => onChangeCondition(idx, { field: event.target.value })}
          >
            <option value="">{t("dataBrowser.selectField")}</option>
            {fields.map((fieldName) => (
              <option key={fieldName} value={fieldName}>{fieldName}</option>
            ))}
          </select>
        </div>

        <div>
          {item.boolType === "sort" ? (
            <select
              className="form-control"
              value={item.sortDirection || "asc"}
              onChange={(event) => onChangeCondition(idx, { sortDirection: event.target.value as SortDirection })}
            >
              <option value="asc">{t("dataBrowser.ascending")}</option>
              <option value="desc">{t("dataBrowser.descending")}</option>
            </select>
          ) : (
            <select
              className="form-control"
              value={item.operator}
              onChange={(event) => onChangeCondition(idx, { operator: event.target.value as ConditionItem["operator"] })}
            >
              <option value="term">{t("dataBrowser.equal")}</option>
              <option value="match">{t("dataBrowser.contain")}</option>
              <option value="range">{t("dataBrowser.range")}</option>
              <option value="time_range">{t("dataBrowser.timeRange")}</option>
              <option value="exists">{t("dataBrowser.exists")}</option>
              <option value="missing">{t("dataBrowser.missing")}</option>
              <option value="terms">{t("dataBrowser.terms")}</option>
              <option value="wildcard">{t("dataBrowser.wildcard")}</option>
            </select>
          )}
        </div>

        <div>
          {item.boolType === "sort" ? (
            <span className="form-control" style={{ background: "#f8fafc", color: "#94a3b8", cursor: "not-allowed" }}>-</span>
          ) : item.operator === "time_range" ? (
            <RangePicker
              showTime
              size="small"
              value={item.rangeValue}
              onChange={(dates) => onChangeCondition(idx, { rangeValue: dates })}
              presets={presets}
              style={{ width: "100%", height: "32px" }}
              placeholder={[t("dataBrowser.startTime"), t("dataBrowser.endTime")]}
              disabled={!item.enabled}
            />
          ) : item.operator === "exists" || item.operator === "missing" ? (
            <span className="form-control" style={{ background: "#f8fafc", color: "#94a3b8", fontSize: "12px" }}>
              {t("dataBrowser.noValueNeeded")}
            </span>
          ) : (
            <input
              className="form-control"
              value={item.value}
              onChange={(event) => onChangeCondition(idx, { value: event.target.value })}
              placeholder={item.operator === "range" ? t("dataBrowser.rangeExample") : item.operator === "terms" ? t("dataBrowser.termsExample") : t("dataBrowser.placeholder")}
            />
          )}
        </div>

        <div className="flex-gap justify-end">
          <button className="btn btn-ghost btn-icon" onClick={() => onAddCondition(idx)} title={t("dataBrowser.addRow")}>+</button>
          <button className="btn btn-ghost btn-icon text-danger" onClick={() => onRemoveCondition(idx)} title={t("dataBrowser.deleteRow")}>&minus;</button>
        </div>
      </div>
    );
  }, [conditionIds, fields, i18nLanguage, presets, t, onAddCondition, onChangeCondition, onClose, onRemoveCondition, onToggleCondition]);

  return (
    <div className="card" style={{ flex: "0 0 auto", maxHeight: "280px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div className="card-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <h3 className="card-title" style={{ margin: 0 }}>{t("dataBrowser.queryCondition")}</h3>
        </div>
        <div className="flex-gap">
          <button
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            aria-expanded={showQueryConditions}
            title={t("common.close")}
          >
            {t("common.close")}
          </button>
        </div>
      </div>

      <div className="card-body" style={{ flex: 1, minHeight: 0, overflow: "auto", paddingRight: "8px" }}>
        <div>
          <div className="query-builder-header-row">
            <div className="col-header">{t("dataBrowser.type")}</div>
            <div className="col-header">{t("dataBrowser.field")}</div>
            <div className="col-header">{t("dataBrowser.operator")}</div>
            <div className="col-header">{t("dataBrowser.value")}</div>
            <div className="col-header">{t("dataBrowser.operation")}</div>
          </div>

          {conditions.map((item, idx) => renderCondition(item, idx))}
        </div>
      </div>
    </div>
  );
}
