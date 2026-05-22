import { ConfigProvider, DatePicker } from "antd";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/zh-cn";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import FieldFilterButton, { type FieldFilterState } from "../features/data-browser/components/FieldFilterButton";
import { logError } from "../../../lib/errorLog";
import { useElasticsearchContext } from "../../../state/ElasticsearchContext";
import { loadEsIndexFields } from "../services/searchService";
import { executeEsSqlSelect } from "../services/sqlService";

const { RangePicker } = DatePicker;

type SqlOperation = "select" | "insert" | "update" | "delete";

type WhereCondition = {
  field: string;
  operator: string;
  value: string;
  enabled: boolean;
  rangeValue?: [Dayjs | null, Dayjs | null] | null;
};

type SqlQueryCacheState = {
  selectedIndex?: string;
  result: { columns: string[]; rows: Array<Array<unknown>> } | null;
  operation: SqlOperation;
  whereConditions: WhereCondition[];
  payload: string;
  limit: number;
  fieldFilter: FieldFilterState;
};

const sqlQueryCacheByConnection = new Map<string, SqlQueryCacheState>();

/** 提取 enabledConditions 逻辑，消除重复 */
function getEnabledConditions(conds: WhereCondition[]) {
  return conds.filter((c) =>
    c.enabled && c.field && (c.value || (c.operator === "RANGE" && c.rangeValue && c.rangeValue[0] && c.rangeValue[1]) || c.operator === "IS NULL" || c.operator === "IS NOT NULL")
  );
}

export default function SqlQuery() {
  const { t, i18n } = useTranslation();
  const { activeConnection, indices } = useElasticsearchContext();
  const [selectedIndex, setSelectedIndex] = useState<string | undefined>(undefined);
  const [operation, setOperation] = useState<SqlOperation>("select");
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [whereConditions, setWhereConditions] = useState<WhereCondition[]>([
    { field: "", operator: "=", value: "", enabled: true }
  ]);
  const [payload, setPayload] = useState("{}");
  const [sql, setSql] = useState("");
  const [limit, setLimit] = useState(100);
  const [result, setResult] = useState<{ columns: string[]; rows: Array<Array<unknown>> } | null>(null);
  const [error, setError] = useState("");
  const [totalRows, setTotalRows] = useState(0);
  const [expandedSqlRows, setExpandedSqlRows] = useState<Set<number>>(new Set());
  const [selectedSqlRow, setSelectedSqlRow] = useState<number | null>(null);
  const [showConditions, setShowConditions] = useState(false);
  const [fieldFilter, setFieldFilter] = useState<FieldFilterState>({ enabled: false, fields: [] });

  const presets = useMemo(() => [
    { label: t('presets.lastHour'), value: [dayjs().subtract(1, 'hour'), dayjs()] as [Dayjs, Dayjs] },
    { label: t('presets.last24Hours'), value: [dayjs().subtract(24, 'hour'), dayjs()] as [Dayjs, Dayjs] },
    { label: t('presets.last7Days'), value: [dayjs().subtract(7, 'day'), dayjs()] as [Dayjs, Dayjs] },
    { label: t('presets.today'), value: [dayjs().startOf('day'), dayjs().endOf('day')] as [Dayjs, Dayjs] },
    { label: t('presets.yesterday'), value: [dayjs().subtract(1, 'day').startOf('day'), dayjs().subtract(1, 'day').endOf('day')] as [Dayjs, Dayjs] },
  ], [t]);

  useEffect(() => {
    dayjs.locale(i18n.language === "zh" ? "zh-cn" : "en");
  }, [i18n.language]);

  useEffect(() => {
    const connectionId = activeConnection?.id;
    if (!connectionId) {
      setSelectedIndex(undefined);
      setAvailableFields([]);
      setResult(null);
      setOperation("select");
      setWhereConditions([{ field: "", operator: "=", value: "", enabled: true }]);
      setPayload("{}");
      setLimit(100);
      setFieldFilter({ enabled: false, fields: [] });
      setShowConditions(false);
      return;
    }

    const cached = sqlQueryCacheByConnection.get(connectionId);
    if (!cached) {
      setSelectedIndex(undefined);
      setAvailableFields([]);
      setResult(null);
      setOperation("select");
      setWhereConditions([{ field: "", operator: "=", value: "", enabled: true }]);
      setPayload("{}");
      setLimit(100);
      setFieldFilter({ enabled: false, fields: [] });
      setShowConditions(false);
      return;
    }

    setSelectedIndex(cached.selectedIndex);
    setResult(cached.result);
    setOperation(cached.operation);
    setWhereConditions(cached.whereConditions.length > 0 ? cached.whereConditions : [{ field: "", operator: "=", value: "", enabled: true }]);
    setPayload(cached.payload);
    setLimit(cached.limit);
    setFieldFilter(cached.fieldFilter);
    setShowConditions(cached.whereConditions.some((item) => item.field || item.value || item.operator === "RANGE"));
  }, [activeConnection?.id]);

  useEffect(() => {
    if (selectedIndex && !indices.includes(selectedIndex)) {
      setSelectedIndex(undefined);
      setResult(null);
    }
  }, [indices, selectedIndex]);

  useEffect(() => {
    const connectionId = activeConnection?.id;
    if (!connectionId) return;
    sqlQueryCacheByConnection.set(connectionId, {
      selectedIndex,
      result,
      operation,
      whereConditions,
      payload,
      limit,
      fieldFilter
    });
  }, [activeConnection?.id, selectedIndex, result, operation, whereConditions, payload, limit, fieldFilter]);

  useEffect(() => {
    if (!activeConnection || !selectedIndex) {
      setAvailableFields([]);
      return;
    }
    let ignore = false;
    loadEsIndexFields(activeConnection, selectedIndex)
      .then((fields) => {
        if (ignore) return;
        setAvailableFields(fields);
      })
      .catch(() => {
        if (ignore) return;
        setAvailableFields([]);
      });
    return () => { ignore = true; };
  }, [activeConnection?.id, selectedIndex]);

  const formatDateTime = (value: Dayjs | null) => (value ? value.format("YYYY-MM-DD HH:mm:ss") : "");

  // 生成 DSL 查询和显示用的 SQL 字符串
  useEffect(() => {
    const name = selectedIndex || "your_index";
    let displaySql = "";
    switch (operation) {
      case "select": {
        const fieldsPart = !fieldFilter.enabled ? "*" : fieldFilter.fields.join(", ");
        const enabledConditions = getEnabledConditions(whereConditions);

        const conditions: string[] = enabledConditions.map((c) => {
          if (c.operator === "RANGE" && c.rangeValue && c.rangeValue[0] && c.rangeValue[1]) {
            const startStr = formatDateTime(c.rangeValue[0]);
            const endStr = formatDateTime(c.rangeValue[1]);
            return `${c.field} >= '${startStr}' AND ${c.field} <= '${endStr}'`;
          }

          switch (c.operator) {
            case "=": return `${c.field} = '${c.value}'`;
            case "!=": return `${c.field} != '${c.value}'`;
            case ">": return `${c.field} > '${c.value}'`;
            case ">=": return `${c.field} >= '${c.value}'`;
            case "<": return `${c.field} < '${c.value}'`;
            case "<=": return `${c.field} <= '${c.value}'`;
            case "LIKE": return `${c.field} LIKE '%${c.value}%'`;
            case "IN": return `${c.field} IN (${c.value})`;
            case "IS NULL": return `${c.field} IS NULL`;
            case "IS NOT NULL": return `${c.field} IS NOT NULL`;
            default: return `${c.field} = '${c.value}'`;
          }
        });

        const wherePart = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
        displaySql = `SELECT ${fieldsPart} FROM ${name}${wherePart} LIMIT ${limit}`;
        break;
      }
      case "insert":
        displaySql = `INSERT INTO ${name} VALUES ${payload}`;
        break;
      case "update":
        displaySql = `UPDATE ${name} SET ${payload}`;
        break;
      case "delete":
        displaySql = `DELETE FROM ${name}`;
        break;
      default:
        displaySql = "";
    }
    // 避免相同 SQL 触发不必要的重渲染
    setSql((prev) => prev === displaySql ? prev : displaySql);
  }, [operation, selectedIndex, whereConditions, payload, limit, fieldFilter.enabled, fieldFilter.fields]);

  // 构建 Elasticsearch DSL 查询
  const buildDslQuery = () => {
    const enabledConditions = getEnabledConditions(whereConditions);

    let query: any = { match_all: {} };
    const boolBuckets: Record<string, any[]> = { must: [] };

    for (const c of enabledConditions) {
      if (c.operator === "RANGE" && c.rangeValue && c.rangeValue[0] && c.rangeValue[1]) {
        const startStr = formatDateTime(c.rangeValue[0]);
        const endStr = formatDateTime(c.rangeValue[1]);
        boolBuckets.must.push({
          range: { [c.field]: { gte: startStr, lte: endStr } }
        });
        continue;
      }

      switch (c.operator) {
        case "=":
          boolBuckets.must.push({ term: { [c.field]: c.value } });
          break;
        case "!=":
          boolBuckets.must.push({ bool: { must_not: { term: { [c.field]: c.value } } } });
          break;
        case ">":
          boolBuckets.must.push({ range: { [c.field]: { gt: c.value } } });
          break;
        case ">=":
          boolBuckets.must.push({ range: { [c.field]: { gte: c.value } } });
          break;
        case "<":
          boolBuckets.must.push({ range: { [c.field]: { lt: c.value } } });
          break;
        case "<=":
          boolBuckets.must.push({ range: { [c.field]: { lte: c.value } } });
          break;
        case "LIKE":
          boolBuckets.must.push({ match: { [c.field]: c.value } });
          break;
        case "IN": {
          const terms = c.value.split(",").map((v) => v.trim()).filter(Boolean);
          if (terms.length > 0) {
            boolBuckets.must.push({ terms: { [c.field]: terms } });
          }
          break;
        }
        case "IS NULL":
          boolBuckets.must.push({ bool: { must_not: { exists: { field: c.field } } } });
          break;
        case "IS NOT NULL":
          boolBuckets.must.push({ exists: { field: c.field } });
          break;
        default:
          boolBuckets.must.push({ term: { [c.field]: c.value } });
      }
    }

    if (boolBuckets.must.length > 0) {
      query = { bool: { must: boolBuckets.must } };
    }

    return {
      size: limit,
      query,
      track_total_hits: true
    };
  };

  const execute = async () => {
    setError("");
    setResult(null);
    if (!activeConnection) {
      setError(t('simpleQuery.noConnectionSelected'));
      return;
    }
    if (operation !== "select") {
      setError(t('simpleQuery.onlySupportsQuery'));
      return;
    }
    if (!selectedIndex) {
      setError(t('dataBrowser.pleaseSelectIndex'));
      return;
    }

    try {
      const body = buildDslQuery();
      const { result: nextResult, totalRows: nextTotalRows } = await executeEsSqlSelect(
        activeConnection,
        selectedIndex,
        body,
        availableFields,
        fieldFilter,
      );
      setResult(nextResult);
      setTotalRows(nextTotalRows);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.error');
      logError(err, {
        source: "esSqlQuery.execute",
        message: `Elasticsearch DSL query execution failed for index ${selectedIndex ?? "unknown"}`
      });
      setError(`${t('simpleQuery.error')} ${message}`);
    }
  };

  const handleLimitChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newLimit = Math.max(1, Math.min(1000, parseInt(event.target.value) || 100));
    setLimit(newLimit);
  };

  const handleConditionChange = (idx: number, next: Partial<WhereCondition>) => {
    setWhereConditions((prev) => prev.map((item, index) => (index === idx ? { ...item, ...next } : item)));
  };

  const addCondition = () => {
    if (!showConditions) {
      setShowConditions(true);
    }
    setWhereConditions((prev) => [...prev, { field: "", operator: "=", value: "", enabled: true }]);
  };

  const removeCondition = (idx: number) => {
    if (whereConditions.length === 1) {
      setWhereConditions([{ field: "", operator: "=", value: "", enabled: true }]);
    } else {
      setWhereConditions((prev) => prev.filter((_, index) => index !== idx));
    }
  };

  const toggleCondition = (idx: number) => {
    setWhereConditions((prev) => prev.map((item, index) => (index === idx ? { ...item, enabled: !item.enabled } : item)));
  };

  const toggleSqlRowExpand = (idx: number) => {
    setExpandedSqlRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const formatDateString = (input: string) => {
    const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
    if (!isoPattern.test(input)) return null;
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) return null;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const renderSqlCellValue = (val: unknown) => {
    if (val === null || val === undefined) return <span className="muted">-</span>;
    const formatted = typeof val === "string" ? formatDateString(val) : null;
    const str = formatted ?? (typeof val === "object" ? JSON.stringify(val) : String(val));
    const shouldTruncate = str.length > 80;
    const preview = shouldTruncate ? `${str.substring(0, 80)}...` : str;
    return (
      <span className="truncated-cell" title={str} data-truncated={shouldTruncate ? "true" : "false"}>
        <span className="truncated-text">{preview}</span>
      </span>
    );
  };

  return (
    <>
      <div className="page" style={{ flex: 1, minHeight: 0, height: "100%" }}>
      <div className="flex-gap items-center" style={{ margin: '0 0 16px 0' }}>
        <div className="module-toolbar-field" style={{ flex: '0 0 auto' }}>
          <label>{t('simpleQuery.operationType')}</label>
          <select className="form-control" value={operation} onChange={(event) => setOperation(event.target.value as SqlOperation)} style={{ width: '160px' }}>
            <option value="select">{t('simpleQuery.select')}</option>
            <option value="insert">{t('simpleQuery.insert')}</option>
            <option value="update">{t('simpleQuery.update')}</option>
            <option value="delete">{t('simpleQuery.delete')}</option>
          </select>
        </div>

        <div className="module-toolbar-field" style={{ flex: '0 0 auto' }}>
          <label>{t('simpleQuery.selectIndex')}</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '260px' }}>
            <select
              className="form-control"
              value={selectedIndex ?? ""}
              onChange={(event) => setSelectedIndex(event.target.value || undefined)}
              style={{ paddingRight: selectedIndex ? '30px' : '12px' }}
            >
              <option value="">{t('simpleQuery.selectIndexPlaceholder')}</option>
              {indices
                .filter((item) => !item.startsWith('.'))
                .sort()
                .map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
            </select>
            {selectedIndex && (
              <button
                onClick={() => setSelectedIndex(undefined)}
                className="btn-clear"
                style={{
                  position: 'absolute',
                  right: '24px',
                  background: 'none',
                  border: 'none',
                  color: '#86868b',
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title={t('common.clear')}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {operation === "select" && (
          <div className="module-toolbar-field" style={{ flex: '0 0 auto' }}>
            <label>{t('simpleQuery.resultLimit')}</label>
            <input
              type="number"
              className="form-control"
              value={limit}
              onChange={handleLimitChange}
              min="1"
              max="1000"
              style={{ width: '80px', padding: '4px 8px' }}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '20px' }}>
          <button className="btn btn-primary btn-sm" onClick={execute}>
            <span>▶</span> {t('simpleQuery.query')}
          </button>

          {operation === "select" && (
            <button className="btn btn-secondary btn-sm" onClick={addCondition}>
              <span>+</span> {t('simpleQuery.filter')}
            </button>
          )}

          {operation === "select" && (
            <FieldFilterButton
              allFields={availableFields}
              state={fieldFilter}
              onChange={setFieldFilter}
              align="left"
              label={t('simpleQuery.fieldFilter')}
            />
          )}
        </div>
      </div>

      {operation === "select" && showConditions && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', marginTop: '16px' }}>
                <label style={{ fontWeight: 600, margin: 0 }}>{t('simpleQuery.whereCondition')}</label>
                <button className="btn btn-sm btn-ghost" onClick={() => setShowConditions(false)}>
                  {t('common.close')}
                </button>
              </div>

              <div style={{
                background: '#fbfbfd',
                borderRadius: '12px',
                border: '1px solid rgba(0,0,0,0.05)',
                padding: '16px'
              }}>
                {whereConditions.map((cond, idx) => (
                  <div key={idx} style={{
                    display: 'grid',
                    gridTemplateColumns: '40px 1fr 120px 1fr 80px',
                    gap: '8px',
                    marginBottom: idx < whereConditions.length - 1 ? '8px' : '0',
                    opacity: cond.enabled ? 1 : 0.5
                  }}>
                    <label className="switch" style={{ margin: 'auto' }}>
                      <input
                        type="checkbox"
                        checked={cond.enabled}
                        onChange={() => toggleCondition(idx)}
                      />
                      <span className="slider"></span>
                    </label>
                    <select
                      className="form-control"
                      value={cond.field}
                      onChange={(event) => handleConditionChange(idx, { field: event.target.value })}
                      disabled={!cond.enabled}
                    >
                      <option value="">{t('simpleQuery.selectField')}</option>
                      {availableFields.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                    <select
                      className="form-control"
                      value={cond.operator}
                      onChange={(event) => handleConditionChange(idx, { operator: event.target.value })}
                      disabled={!cond.enabled}
                    >
                      <option value="=">=</option>
                      <option value="!=">!=</option>
                      <option value=">">&gt;</option>
                      <option value=">=">&gt;=</option>
                      <option value="<">&lt;</option>
                      <option value="<=">&lt;=</option>
                      <option value="LIKE">LIKE</option>
                      <option value="IN">IN</option>
                      <option value="IS NULL">IS NULL</option>
                      <option value="IS NOT NULL">IS NOT NULL</option>
                      <option value="RANGE">{t('simpleQuery.timeRange')}</option>
                    </select>
                    {cond.operator === 'RANGE' ? (
                      <ConfigProvider locale={i18n.language === "zh" ? zhCN : enUS}>
                        <RangePicker
                          showTime
                          size="small"
                          value={cond.rangeValue}
                          onChange={(dates) => handleConditionChange(idx, { rangeValue: dates })}
                          presets={presets}
                          style={{ width: '100%', height: '32px' }}
                          placeholder={[t('simpleQuery.startTime'), t('simpleQuery.endTime')]}
                          disabled={!cond.enabled}
                        />
                      </ConfigProvider>
                    ) : cond.operator === 'IS NULL' || cond.operator === 'IS NOT NULL' ? (
                      <input
                        className="form-control"
                        value="-"
                        disabled
                        style={{ background: '#f8fafc', color: '#94a3b8', cursor: 'not-allowed' }}
                      />
                    ) : (
                      <input
                        className="form-control"
                        value={cond.value}
                        onChange={(event) => handleConditionChange(idx, { value: event.target.value })}
                        placeholder={cond.operator === 'IN' ? t('simpleQuery.inExample') : t('simpleQuery.enterValue')}
                        disabled={!cond.enabled}
                      />
                    )}
                    <button
                      className="btn btn-sm btn-ghost text-danger"
                      onClick={() => removeCondition(idx)}
                      title={t('simpleQuery.deleteCondition')}
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="form-grid" style={{ marginTop: '16px' }}>
            {operation !== "select" && (
              <div className="span-2">
                <label>{t('simpleQuery.setValues')}</label>
                <textarea className="form-control json-editor" style={{ height: '100px' }} value={payload} onChange={(event) => setPayload(event.target.value)} />
              </div>
            )}
            <div className="span-2">
              <label>{t('simpleQuery.queryPreview')}</label>
              <textarea className="form-control json-editor" style={{ height: '100px', background: '#fbfbfd', color: '#1d1d1f' }} value={sql} onChange={(event) => setSql(event.target.value)} readOnly />
            </div>
          </div>
          <div className="toolbar">
            {error && <span className="text-danger">{error}</span>}
          </div>

      <div className="card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="card-header">
          <h3 className="card-title">
            {t('simpleQuery.queryResult', { count: result ? totalRows : 0 })}
          </h3>
        </div>

        {!result && (
          <div className="card-body" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p className="muted" style={{ textAlign: 'center' }}>{t('simpleQuery.noResults')}</p>
          </div>
        )}

        {result && (
          <div style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            borderTop: '1px solid #e2e8f0'
          }}>
            <table className="table">
              <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
                <tr>
                  <th style={{ width: '48px', textAlign: 'center' }}> </th>
                  {result.columns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, rowIndex) => {
                  const isExpanded = expandedSqlRows.has(rowIndex);
                  const isHighlighted = selectedSqlRow === rowIndex;
                  const rowHighlight = isExpanded || isHighlighted;
                  return (
                  <Fragment key={`row-${rowIndex}`}>
                    <tr style={rowHighlight ? { background: '#eff6ff' } : undefined}>
                      <td style={{ textAlign: 'center', background: rowHighlight ? '#eff6ff' : 'inherit', position: rowHighlight ? 'sticky' : undefined, left: rowHighlight ? 0 : undefined, zIndex: rowHighlight ? 5 : undefined, borderRight: rowHighlight ? '2px solid #93c5fd' : undefined }}>
                        <button
                          className="btn btn-ghost btn-icon"
                          onClick={() => toggleSqlRowExpand(rowIndex)}
                          style={{ fontSize: '10px', padding: '2px 6px' }}
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      </td>
                      {result.columns.map((col, colIndex) => (
                        <td
                          key={`row${rowIndex}-${colIndex}-${col}`}
                          style={{ cursor: 'pointer', background: rowHighlight ? '#eff6ff' : undefined }}
                          onClick={() => setSelectedSqlRow(isHighlighted ? null : rowIndex)}
                        >
                          {renderSqlCellValue(row[colIndex])}
                        </td>
                      ))}
                    </tr>
                    {isExpanded && (
                      <tr className="expanded-row">
                        <td colSpan={result.columns.length + 1} style={{ padding: 0, background: '#eff6ff', position: 'sticky', left: 0, zIndex: 5 }}>
                          <div style={{ borderLeft: '3px solid #3b82f6' }}>
                            <div style={{ padding: '12px 16px' }}>
                              <pre style={{ margin: 0, fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                {JSON.stringify(
                                  Object.fromEntries(result.columns.map((col, ci) => [col, row[ci]])),
                                  null, 2
                                )}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      </div>
    </>
  );
}
