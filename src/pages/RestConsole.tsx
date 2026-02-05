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
  finishedAt: number | null;
};

type BatchResult = {
  index: number;
  method: HttpMethod;
  path: string;
  status: number | null;
  ok: boolean | null;
  timeMs: number;
  body: string;
  error?: string;
};

type ScriptTemplate = {
  id: string;
  name: string;
  content: string;
  updatedAt: number;
};

export default function RestConsole() {
  const { getActiveConnection } = useAppContext();
  const activeConnection = useMemo(() => getActiveConnection(), [getActiveConnection]);

  const [method, setMethod] = useState<HttpMethod>("GET");
  const [path, setPath] = useState("/_cluster/health");
  const [requestBody, setRequestBody] = useState("");
  const [batchMode, setBatchMode] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [batchExpanded, setBatchExpanded] = useState<Set<number>>(new Set());
  const [concurrency, setConcurrency] = useState(3);
  const [stopOnError, setStopOnError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [retryDelayMs, setRetryDelayMs] = useState(500);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchCompleted, setBatchCompleted] = useState(0);
  const [templates, setTemplates] = useState<ScriptTemplate[]>(() => {
    try {
      const raw = localStorage.getItem("restConsoleTemplates");
      if (!raw) return [];
      const parsed = JSON.parse(raw) as ScriptTemplate[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateName, setTemplateName] = useState("");
  const [response, setResponse] = useState<ResponseState>({ status: null, ok: null, timeMs: null, body: "", finishedAt: null });
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

  const formatFinishedAt = (timestamp: number) => new Date(timestamp).toLocaleString("zh-CN");

  const parseBatchCommands = (text: string) => {
    const lines = text.split(/\r?\n/);
    const methodSet = new Set(METHODS);
    const commands: Array<{ method: HttpMethod; path: string; bodyText: string }> = [];
    let current: { method: HttpMethod; path: string; bodyLines: string[] } | null = null;

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) {
        if (current) {
          current.bodyLines.push(line);
        }
        continue;
      }

      const match = trimmed.match(/^(GET|POST|PUT|DELETE|PATCH|HEAD)\s+(\S+)/i);
      if (match) {
        const methodCandidate = match[1].toUpperCase() as HttpMethod;
        if (!methodSet.has(methodCandidate)) {
          continue;
        }
        if (current) {
          commands.push({
            method: current.method,
            path: current.path,
            bodyText: current.bodyLines.join("\n").trim()
          });
        }
        current = {
          method: methodCandidate,
          path: normalizePath(match[2]),
          bodyLines: []
        };
        continue;
      }

      if (current) {
        current.bodyLines.push(line);
      }
    }

    if (current) {
      commands.push({
        method: current.method,
        path: current.path,
        bodyText: current.bodyLines.join("\n").trim()
      });
    }

    return commands;
  };

  const formatBatchText = (text: string) => {
    const commands = parseBatchCommands(text);
    if (commands.length === 0) {
      throw new Error("未检测到请求命令，请以 'METHOD /path' 开头");
    }
    return commands
      .map((cmd) => {
        let bodyBlock = "";
        if (cmd.bodyText) {
          const formatted = formatJson(cmd.bodyText);
          bodyBlock = `\n${formatted}`;
        }
        return `${cmd.method} ${cmd.path}${bodyBlock}`;
      })
      .join("\n\n")
      .trim();
  };

  const handleFormatRequest = () => {
    setError("");
    try {
      if (batchMode) {
        const formattedBatch = formatBatchText(batchText);
        setBatchText(formattedBatch);
        return;
      }
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

  const persistTemplates = (next: ScriptTemplate[]) => {
    setTemplates(next);
    localStorage.setItem("restConsoleTemplates", JSON.stringify(next));
  };

  const handleSaveTemplate = () => {
    const content = batchMode ? batchText.trim() : "";
    if (!batchMode) {
      setError("仅支持批量模式保存模板");
      return;
    }
    if (!content) {
      setError("模板内容不能为空");
      return;
    }
    const name = templateName.trim();
    if (!name) {
      setError("请输入模板名称");
      return;
    }
    const now = Date.now();
    const existing = templates.find((t) => t.name === name);
    if (existing) {
      const updated = templates.map((t) => (t.id === existing.id ? { ...t, content, updatedAt: now } : t));
      persistTemplates(updated);
      setSelectedTemplateId(existing.id);
      return;
    }
    const next: ScriptTemplate = {
      id: `${now}-${Math.random().toString(16).slice(2)}`,
      name,
      content,
      updatedAt: now
    };
    persistTemplates([next, ...templates]);
    setSelectedTemplateId(next.id);
  };

  const handleLoadTemplate = (id: string) => {
    setSelectedTemplateId(id);
    const target = templates.find((t) => t.id === id);
    if (!target) return;
    setBatchMode(true);
    setBatchText(target.content);
    setTemplateName(target.name);
  };

  const handleDeleteTemplate = () => {
    if (!selectedTemplateId) return;
    const target = templates.find((t) => t.id === selectedTemplateId);
    if (!target) return;
    if (!window.confirm(`确定删除模板 “${target.name}” 吗？`)) return;
    const next = templates.filter((t) => t.id !== selectedTemplateId);
    persistTemplates(next);
    setSelectedTemplateId("");
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  const downloadText = (filename: string, text: string) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExecute = async () => {
    setError("");
    setLoading(true);
    setResponse({ status: null, ok: null, timeMs: null, body: "", finishedAt: null });
    setBatchResults([]);
    setBatchExpanded(new Set());
    setBatchCompleted(0);
    setBatchTotal(0);

    if (!activeConnection) {
      setError("请先在连接配置中选择当前连接");
      setLoading(false);
      return;
    }

    if (batchMode) {
      const commands = parseBatchCommands(batchText);
      if (commands.length === 0) {
        setError("未检测到请求命令，请以 'METHOD /path' 开头");
        setLoading(false);
        return;
      }

      setBatchTotal(commands.length);

      const start = performance.now();
      const results: BatchResult[] = new Array(commands.length);
      let cursor = 0;
      let stopped = false;

      const worker = async () => {
        while (true) {
          if (stopped) return;
          const current = cursor;
          cursor += 1;
          if (current >= commands.length) return;
          const cmd = commands[current];
          const headerPath = cmd.path || "";

          if (!headerPath) {
            results[current] = {
              index: current,
              method: cmd.method,
              path: cmd.path,
              status: null,
              ok: false,
              timeMs: 0,
              body: "",
              error: "缺少请求路径"
            };
            if (stopOnError) {
              stopped = true;
              return;
            }
            continue;
          }

          let body: unknown = undefined;
          if (cmd.bodyText) {
            try {
              body = JSON.parse(cmd.bodyText);
            } catch (err) {
              results[current] = {
                index: current,
                method: cmd.method,
                path: cmd.path,
                status: null,
                ok: false,
                timeMs: 0,
                body: "",
                error: `请求体 JSON 格式错误：${err instanceof Error ? err.message : "无法解析"}`
              };
              if (stopOnError) {
                stopped = true;
                return;
              }
              continue;
            }
          }

          const reqStart = performance.now();
          let attempt = 0;
          let lastError: string | null = null;
          while (attempt <= retryCount) {
            try {
              const res = await esRequestRaw(activeConnection, cmd.path, {
                method: cmd.method,
                body
              });

              let nextBody = res.body;
              if (pretty) {
                try {
                  nextBody = JSON.stringify(JSON.parse(res.body), null, 2);
                } catch {
                  // keep raw if not json
                }
              }

              results[current] = {
                index: current,
                method: cmd.method,
                path: cmd.path,
                status: res.status,
                ok: res.ok,
                timeMs: Math.round(performance.now() - reqStart),
                body: nextBody
              };
              lastError = null;
              break;
            } catch (err) {
              lastError = err instanceof Error ? err.message : String(err);
              if (attempt >= retryCount) {
                results[current] = {
                  index: current,
                  method: cmd.method,
                  path: cmd.path,
                  status: null,
                  ok: false,
                  timeMs: Math.round(performance.now() - reqStart),
                  body: "",
                  error: lastError
                };
                if (stopOnError) {
                  stopped = true;
                  break;
                }
              } else {
                await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
              }
            }
            attempt += 1;
          }
          if (stopOnError && stopped) {
            setBatchCompleted((prev) => prev + 1);
            return;
          }
          setBatchCompleted((prev) => prev + 1);
        }
      };

      const workerCount = Math.max(1, Math.min(10, Math.floor(concurrency)));
      await Promise.all(Array.from({ length: workerCount }, () => worker()));

      const timeMs = Math.round(performance.now() - start);
      const filled = results.filter(Boolean) as BatchResult[];
      setBatchResults(filled);
      setResponse({ status: null, ok: null, timeMs, body: "", finishedAt: null });
      if (filled.length > 0) {
        setBatchExpanded(new Set([filled[0].index]));
      }
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
        body: nextBody,
        finishedAt: Date.now()
      });
    } catch (err) {
      setError(`请求失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setResponse((prev) => (prev.finishedAt ? prev : { ...prev, finishedAt: Date.now() }));
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
            {!batchMode && (
              <>
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
              </>
            )}
            <label className="rest-pretty-toggle">
              <input type="checkbox" checked={pretty} onChange={(e) => setPretty(e.target.checked)} />
              美化返回
            </label>
            <label className="rest-pretty-toggle">
              <input type="checkbox" checked={batchMode} onChange={(e) => setBatchMode(e.target.checked)} />
              批量模式
            </label>
            {batchMode && (
              <>
                <label className="rest-pretty-toggle">
                  并发
                  <input
                    type="number"
                    min={1}
                    max={10}
                    className="form-control rest-concurrency"
                    value={concurrency}
                    onChange={(e) => setConcurrency(Number(e.target.value) || 1)}
                  />
                </label>
                <label className="rest-pretty-toggle">
                  <input type="checkbox" checked={stopOnError} onChange={(e) => setStopOnError(e.target.checked)} />
                  失败即停止
                </label>
                <label className="rest-pretty-toggle">
                  重试
                  <input
                    type="number"
                    min={0}
                    max={5}
                    className="form-control rest-concurrency"
                    value={retryCount}
                    onChange={(e) => setRetryCount(Math.max(0, Number(e.target.value) || 0))}
                  />
                </label>
                <label className="rest-pretty-toggle">
                  间隔(ms)
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    className="form-control rest-concurrency"
                    value={retryDelayMs}
                    onChange={(e) => setRetryDelayMs(Math.max(0, Number(e.target.value) || 0))}
                  />
                </label>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => {
                    if (batchResults.length === 0) return;
                    const allExpanded = batchResults.every((r) => batchExpanded.has(r.index));
                    if (allExpanded) {
                      setBatchExpanded(new Set());
                    } else {
                      setBatchExpanded(new Set(batchResults.map((r) => r.index)));
                    }
                  }}
                >
                  {batchResults.length > 0 && batchResults.every((r) => batchExpanded.has(r.index)) ? "全部折叠" : "全部展开"}
                </button>
              </>
            )}
            <div className="rest-toolbar-actions">
              <button className="btn btn-sm btn-secondary" onClick={handleFormatRequest}>格式化请求</button>
              <button className="btn btn-sm btn-ghost" onClick={handleFormatResponse}>格式化结果</button>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  if (batchMode) {
                    setBatchText("");
                  } else {
                    setRequestBody("");
                  }
                }}
              >
                清空请求
              </button>
            </div>
          </div>

          {batchMode && (
            <div className="rest-template-bar">
              <div className="rest-template-left">
                <select
                  className="form-control rest-template-select"
                  value={selectedTemplateId}
                  onChange={(e) => handleLoadTemplate(e.target.value)}
                >
                  <option value="">选择模板...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <input
                  className="form-control rest-template-input"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="模板名称"
                />
              </div>
              <div className="rest-template-actions">
                <button className="btn btn-sm btn-secondary" onClick={handleSaveTemplate}>保存模板</button>
                <button className="btn btn-sm btn-ghost text-danger" onClick={handleDeleteTemplate} disabled={!selectedTemplateId}>删除模板</button>
              </div>
            </div>
          )}

          {error && <div className="text-danger" style={{ marginBottom: "12px" }}>{error}</div>}

          <div className="rest-console">
            <div className="rest-panel">
              <div className="rest-panel-header">
                {batchMode ? "批量请求" : "请求体 (JSON)"}
              </div>
              {batchMode ? (
                <textarea
                  className="json-editor rest-editor"
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  placeholder={`GET /_cluster/health\n\nPOST /_search\n{\n  "query": {\n    "match_all": {}\n  }\n}`}
                />
              ) : (
                <textarea
                  className="json-editor rest-editor"
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  placeholder={`{\n  "query": {\n    "match_all": {}\n  }\n}`}
                />
              )}
            </div>
            <div className="rest-panel">
              <div className="rest-panel-header">
                <span>响应结果</span>
                <div className="rest-panel-actions">
                  {!batchMode && response.finishedAt !== null && (
                    <span className="rest-finish-time">完成时间 · {formatFinishedAt(response.finishedAt)}</span>
                  )}
                  {!batchMode && (
                    <>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => copyText(response.body || "")}
                        disabled={!response.body}
                      >
                        复制
                      </button>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() =>
                          downloadText(
                            `rest-response-${response.finishedAt ? new Date(response.finishedAt).toISOString().replace(/[:.]/g, "-") : "latest"}.txt`,
                            response.body || ""
                          )
                        }
                        disabled={!response.body}
                      >
                        下载
                      </button>
                    </>
                  )}
                  {response.status !== null && (
                    <span className={`rest-status ${response.ok ? "ok" : "fail"}`}>
                      {response.status} · {response.timeMs ?? 0}ms
                    </span>
                  )}
                  {response.status === null && !response.body && response.timeMs !== null && batchResults.length > 0 && (
                    <span className="rest-status ok">
                      批量完成 · {response.timeMs ?? 0}ms
                    </span>
                  )}
                </div>
              </div>
              {batchMode && batchTotal > 0 && (
                <div className="rest-progress">
                  <div className="rest-progress-track">
                    <div
                      className="rest-progress-bar"
                      style={{ width: `${Math.round((batchCompleted / batchTotal) * 100)}%` }}
                    />
                  </div>
                  <div className="rest-progress-text">
                    {batchCompleted}/{batchTotal}
                  </div>
                </div>
              )}
              {batchMode ? (
                <div className="rest-batch-list">
                  {batchResults.length === 0 && <div className="muted">(暂无响应)</div>}
                  {batchResults.map((item) => {
                    const expanded = batchExpanded.has(item.index);
                    const title = `#${item.index + 1} ${item.method} ${item.path}`;
                    const statusText = item.status !== null ? `${item.status}` : "ERROR";
                    const content = item.error ? `ERROR: ${item.error}` : item.body || "(空响应)";
                    return (
                      <div key={`${item.index}-${item.method}-${item.path}`} className="rest-batch-item">
                        <button
                          className="rest-batch-header"
                          onClick={() => {
                            setBatchExpanded((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.index)) {
                                next.delete(item.index);
                              } else {
                                next.add(item.index);
                              }
                              return next;
                            });
                          }}
                        >
                          <span className="rest-batch-title">{title}</span>
                          <div className="rest-batch-actions">
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={(event) => {
                                event.stopPropagation();
                                copyText(content);
                              }}
                            >
                              复制
                            </button>
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={(event) => {
                                event.stopPropagation();
                                downloadText(`rest-result-${item.index + 1}.txt`, content);
                              }}
                            >
                              下载
                            </button>
                            <span className={`rest-status ${item.ok ? "ok" : "fail"}`}>
                              {statusText} · {item.timeMs}ms
                            </span>
                          </div>
                        </button>
                        {expanded && (
                          <pre className="rest-response">
                            {content}
                          </pre>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <pre className="rest-response">{response.body || "(暂无响应)"}</pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
