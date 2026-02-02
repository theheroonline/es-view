import { useEffect, useMemo, useState } from "react";
import { extractFieldsFromMapping, getIndexMapping, sqlQuery } from "../lib/esView";
import { useAppContext } from "../state/AppContext";
import SqlHistory from "./SqlHistory";

type SqlOperation = "select" | "insert" | "update" | "delete";

type WhereCondition = {
  field: string;
  operator: string;
  value: string;
  enabled: boolean;
};

export default function SqlQuery() {
  const { getActiveConnection, addHistory, indices, selectedIndex, setSelectedIndex } = useAppContext();
  const activeConnection = useMemo(() => getActiveConnection(), [getActiveConnection]);
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

  // 获取索引字段
  useEffect(() => {
    if (!activeConnection || !selectedIndex) {
      setAvailableFields([]);
      return;
    }
    getIndexMapping(activeConnection, selectedIndex)
      .then((mapping) => {
        const extracted = extractFieldsFromMapping(mapping, selectedIndex);
        setAvailableFields(extracted);
      })
      .catch(() => setAvailableFields([]));
  }, [activeConnection, selectedIndex]);

  // 生成 SQL
  useEffect(() => {
    const name = selectedIndex || "your_index";
    let generated = "";
    switch (operation) {
      case "select":
        const fieldsPart = "*";
        const enabledConditions = whereConditions.filter((c) => c.enabled && c.field && c.value);
        const wherePart = enabledConditions.length > 0
          ? ` WHERE ${enabledConditions.map((c) => {
              switch (c.operator) {
                case "=": return `${c.field} = '${c.value}'`;
                case "!=": return `${c.field} != '${c.value}'`;
                case ">": return `${c.field} > ${c.value}`;
                case ">=": return `${c.field} >= ${c.value}`;
                case "<": return `${c.field} < ${c.value}`;
                case "<=": return `${c.field} <= ${c.value}`;
                case "LIKE": return `${c.field} LIKE '%${c.value}%'`;
                default: return `${c.field} = '${c.value}'`;
              }
            }).join(" AND ")}`
          : "";
        generated = `SELECT ${fieldsPart} FROM ${name}${wherePart} LIMIT ${limit}`;
        break;
      case "insert":
        generated = `INSERT INTO ${name} VALUES ${payload}`;
        break;
      case "update":
        generated = `UPDATE ${name} SET ${payload}`;
        break;
      case "delete":
        generated = `DELETE FROM ${name}`;
        break;
      default:
        generated = "";
    }
    setSql(generated);
  }, [operation, selectedIndex, whereConditions, payload, limit]);

  const execute = async () => {
    setError("");
    setResult(null);
    if (!activeConnection) {
      setError("请先在连接配置中选择当前连接");
      return;
    }
    if (operation !== "select") {
      setError("ES SQL 仅支持查询，请使用数据浏览或索引管理完成写操作");
      return;
    }
    try {
      const response = await sqlQuery(activeConnection, sql);
      const columns = response.columns?.map((col: { name: string }) => col.name) ?? [];
      const rows = response.rows ?? [];
      setResult({ columns, rows });
      setTotalRows(rows.length);
      await addHistory(`SQL: ${selectedIndex || "未选择"}`, sql);
    } catch (err) {
      const message = err instanceof Error ? err.message : "查询失败";
      setError(`查询失败：${message}`);
      console.error("SQL 查询错误:", err);
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



  return (
    <>
      <div className="page">
        <h1 className="page-title">SQL 操作</h1>
        <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">SQL 生成器</h3>
            <p className="muted">按条件自动生成 SQL，并使用当前环境与索引执行。</p>
          </div>
          <div className="button-group">
            <button className="btn btn-primary" onClick={execute}>
              <span>▶</span> 执行查询
            </button>
          </div>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <div>
              <label>操作类型</label>
              <select className="form-control" value={operation} onChange={(event) => setOperation(event.target.value as SqlOperation)}>
                <option value="select">查询 (SELECT)</option>
                <option value="insert">新增 (INSERT)</option>
                <option value="update">更新 (UPDATE)</option>
                <option value="delete">删除 (DELETE)</option>
              </select>
            </div>
            <div>
              <label>索引</label>
              <select className="form-control" value={selectedIndex ?? ""} onChange={(event) => setSelectedIndex(event.target.value || undefined)}>
                <option value="">请选择索引...</option>
                {indices.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
          </div>



          {/* WHERE 条件构建器 */}
          {operation === "select" && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ marginBottom: '8px' }}>
                <label style={{ marginRight: '8px' }}>查询结果数量限制</label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={limit} 
                  onChange={handleLimitChange}
                  style={{ width: '120px', display: 'inline-block' }}
                  min="1"
                  max="1000"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontWeight: 600, margin: 0 }}>WHERE 条件</label>
                <button className="btn btn-sm btn-secondary" onClick={addCondition}>
                  <span>+</span> 添加条件
                </button>
              </div>

              <div style={{ 
                background: '#f8fafc', 
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                padding: '12px'
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
                      <option value="">选择字段</option>
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
                    </select>
                    <input 
                      className="form-control"
                      value={cond.value} 
                      onChange={(event) => handleConditionChange(idx, { value: event.target.value })} 
                      placeholder="输入值..." 
                      disabled={!cond.enabled}
                    />
                    <button 
                      className="btn btn-sm btn-ghost text-danger" 
                      onClick={() => removeCondition(idx)}
                      title="删除条件"
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="form-grid" style={{ marginTop: '16px' }}>
            {operation !== "select" && (
              <div className="span-2">
                <label>SET / VALUES (JSON Payload)</label>
                <textarea className="form-control json-editor" style={{ height: '100px' }} value={payload} onChange={(event) => setPayload(event.target.value)} />
              </div>
            )}
            <div className="span-2">
              <label>生成的 SQL 预览</label>
              <textarea className="form-control json-editor" style={{ height: '100px', background: '#f8fafc', color: '#0f172a' }} value={sql} onChange={(event) => setSql(event.target.value)} />
            </div>
          </div>
          <div className="toolbar">
             {error && <span className="text-danger">{error}</span>}
             {!error && <span className="muted">ES 7.1+ SQL 支持查询，写操作推荐使用索引管理或 REST API。</span>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">查询结果 {result && `(显示 ${totalRows} 行)`}</h3>
        </div>

        {!result && (
          <div className="card-body">
            <p className="muted" style={{ textAlign: 'center' }}>暂无结果，请执行查询。</p>
          </div>
        )}

        {result && (
          <div style={{
            height: '600px',
            overflow: 'auto',
            borderTop: '1px solid #e2e8f0'
          }}>
            <table className="table">
              <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
                <tr>
                  {result.columns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex}>{String(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>

      <SqlHistory />
    </>
  );
}
