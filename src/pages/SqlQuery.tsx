import { useEffect, useMemo, useState } from "react";
import { sqlQuery } from "../lib/esView";
import { useAppContext } from "../state/AppContext";
import SqlHistory from "./SqlHistory";

type SqlOperation = "select" | "insert" | "update" | "delete";

export default function SqlQuery() {
  const { getActiveConnection, addHistory, indices, selectedIndex, setSelectedIndex } = useAppContext();
  const activeConnection = useMemo(() => getActiveConnection(), [getActiveConnection]);
  const [operation, setOperation] = useState<SqlOperation>("select");
  const [fields, setFields] = useState("*");
  const [where, setWhere] = useState("");
  const [payload, setPayload] = useState("{}");
  const [sql, setSql] = useState("");
  const [result, setResult] = useState<{ columns: string[]; rows: Array<Array<unknown>> } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const name = selectedIndex || "your_index";
    let generated = "";
    switch (operation) {
      case "select":
        generated = `SELECT ${fields || "*"} FROM ${name}${where ? ` WHERE ${where}` : ""}`;
        break;
      case "insert":
        generated = `INSERT INTO ${name} VALUES ${payload}`;
        break;
      case "update":
        generated = `UPDATE ${name} SET ${payload}${where ? ` WHERE ${where}` : ""}`;
        break;
      case "delete":
        generated = `DELETE FROM ${name}${where ? ` WHERE ${where}` : ""}`;
        break;
      default:
        generated = "";
    }
    setSql(generated);
  }, [operation, selectedIndex, fields, where, payload]);

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
      await addHistory(`SQL: ${selectedIndex || "未选择"}`, sql);
    } catch (err) {
      setError("查询失败，请检查 SQL 或连接");
    }
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
            <div>
              <label>字段 (仅查询)</label>
              <input className="form-control" value={fields} onChange={(event) => setFields(event.target.value)} placeholder="* 或 field1,field2" />
            </div>
          </div>
          <div className="form-grid" style={{ marginTop: '12px' }}>
            <div>
              <label>条件 (WHERE)</label>
              <input className="form-control" value={where} onChange={(event) => setWhere(event.target.value)} placeholder="age > 30 AND status = 'ok'" />
            </div>
            <div className="span-2">
              <label>SET / VALUES (JSON Payload)</label>
              <textarea className="form-control json-editor" style={{ height: '100px' }} value={payload} onChange={(event) => setPayload(event.target.value)} />
            </div>
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
          <h3 className="card-title">查询结果</h3>
        </div>
        
        {!result && (
          <div className="card-body">
            <p className="muted" style={{ textAlign: 'center' }}>暂无结果，请执行查询。</p>
          </div>
        )}
        
        {result && (
          <div className="table-wrapper">
            <table className="table">
              <thead>
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
