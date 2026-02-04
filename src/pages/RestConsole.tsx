import { useMemo, useState } from "react";
import { esRequestRaw } from "../lib/esView";
import { useAppContext } from "../state/AppContext";

const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"] as const;

type HttpMethod = typeof METHODS[number];

type ResponseState = {
  status: number | null;
  ok: boolean | null;
  timeMs: number | null;
  body: string;
};

export default function RestConsole() {
  const { getActiveConnection } = useAppContext();
  const activeConnection = useMemo(() => getActiveConnection(), [getActiveConnection]);

  const [method, setMethod] = useState<HttpMethod>("GET");
  const [path, setPath] = useState("/_cluster/health");
  const [requestBody, setRequestBody] = useState("");
  const [response, setResponse] = useState<ResponseState>({ status: null, ok: null, timeMs: null, body: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pretty, setPretty] = useState(true);

  const normalizePath = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return "";
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  };

  const formatJson = (text: string) => {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  };

  const handleFormatRequest = () => {
    setError("");
    try {
      const formatted = formatJson(requestBody.trim() || "{}");
      setRequestBody(formatted);
    } catch (err) {
      setError(`请求体 JSON 格式错误：${err instanceof Error ? err.message : "无法解析"}`);
    }
  };

  const handleFormatResponse = () => {
    setError("");
    try {
      if (!response.body) return;
      const formatted = formatJson(response.body);
      setResponse((prev) => ({ ...prev, body: formatted }));
    } catch (err) {
      setError(`响应不是有效 JSON：${err instanceof Error ? err.message : "无法解析"}`);
    }
  };

  const handleExecute = async () => {
    setError("");
    setLoading(true);
    setResponse({ status: null, ok: null, timeMs: null, body: "" });

    if (!activeConnection) {
      setError("请先在连接配置中选择当前连接");
      setLoading(false);
      return;
    }

    const normalizedPath = normalizePath(path);
    if (!normalizedPath) {
      setError("请输入请求路径，例如 /_search");
      setLoading(false);
      return;
    }

    let body: unknown = undefined;
    const bodyTrim = requestBody.trim();
    if (bodyTrim) {
      try {
        body = JSON.parse(bodyTrim);
      } catch (err) {
        setError(`请求体 JSON 格式错误：${err instanceof Error ? err.message : "无法解析"}`);
        setLoading(false);
        return;
      }
    }

    const start = performance.now();
    try {
      const res = await esRequestRaw(activeConnection, normalizedPath, {
        method,
        body
      });
      const timeMs = Math.round(performance.now() - start);

      let nextBody = res.body;
      if (pretty) {
        try {
          nextBody = JSON.stringify(JSON.parse(res.body), null, 2);
        } catch {
          // keep raw if not json
        }
      }

      setResponse({
        status: res.status,
        ok: res.ok,
        timeMs,
        body: nextBody
      });
    } catch (err) {
      setError(`请求失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">REST Console</h3>
            <p className="muted" style={{ margin: 0 }}>使用 RESTful 风格执行 ES 高级操作。</p>
          </div>
          <div className="button-group">
            <button className="btn btn-primary" onClick={handleExecute} disabled={loading}>
              {loading ? "执行中..." : "执行"}
            </button>
          </div>
        </div>
        <div className="card-body">
          <div className="rest-toolbar">
            <select className="form-control rest-method" value={method} onChange={(e) => setMethod(e.target.value as HttpMethod)}>
              {METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <input
              className="form-control rest-path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="例如 /_search"
            />
            <label className="rest-pretty-toggle">
              <input type="checkbox" checked={pretty} onChange={(e) => setPretty(e.target.checked)} />
              美化返回
            </label>
            <div className="rest-toolbar-actions">
              <button className="btn btn-sm btn-secondary" onClick={handleFormatRequest}>格式化请求</button>
              <button className="btn btn-sm btn-ghost" onClick={handleFormatResponse}>格式化结果</button>
              <button className="btn btn-sm btn-ghost" onClick={() => setRequestBody("")}>清空请求</button>
            </div>
          </div>

          {error && <div className="text-danger" style={{ marginBottom: "12px" }}>{error}</div>}

          <div className="rest-console">
            <div className="rest-panel">
              <div className="rest-panel-header">请求体 (JSON)</div>
              <textarea
                className="json-editor rest-editor"
                value={requestBody}
                onChange={(e) => setRequestBody(e.target.value)}
                placeholder={`{\n  "query": {\n    "match_all": {}\n  }\n}`}
              />
            </div>
            <div className="rest-panel">
              <div className="rest-panel-header">
                <span>响应结果</span>
                {response.status !== null && (
                  <span className={`rest-status ${response.ok ? "ok" : "fail"}`}>
                    {response.status} · {response.timeMs ?? 0}ms
                  </span>
                )}
              </div>
              <pre className="rest-response">{response.body || "(暂无响应)"}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
