import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { logError } from "../../../lib/errorLog";
import { useElasticsearchContext } from "../../../state/ElasticsearchContext";

const CAT_ENDPOINTS = [
  "aliases", "allocation", "count", "fielddata", "health",
  "indices", "master", "nodes", "pending_tasks", "plugins",
  "recovery", "repositories", "segments", "shards", "tasks",
  "templates", "thread_pool",
];

export default function ClusterInfo() {
  const { t } = useTranslation();
  const { activeConnection, esVersion } = useElasticsearchContext();

  const [clusterInfo, setClusterInfo] = useState<Record<string, unknown> | null>(null);
  const [clusterHealth, setClusterHealth] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Cat API browser
  const [catEndpoint, setCatEndpoint] = useState("indices");
  const [catData, setCatData] = useState<Array<Record<string, string>>>([]);
  const [catColumns, setCatColumns] = useState<string[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [catIndexFilter, setCatIndexFilter] = useState("");

  // Node stats
  const [nodeStats, setNodeStats] = useState<Array<Record<string, unknown>>>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  const loadClusterInfo = useCallback(async () => {
    if (!activeConnection) return;
    setLoading(true);
    setError("");
    try {
      const { esRequest } = await import("../services/client");
      const [info, health] = await Promise.all([
        esRequest<any>(activeConnection, "/"),
        esRequest<any>(activeConnection, "/_cluster/health"),
      ]);
      setClusterInfo(info);
      setClusterHealth(health);
    } catch (err) {
      logError(err, { source: "clusterInfo.load", message: "Failed to load cluster info" });
      setError(t("clusterInfo.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [activeConnection, t]);

  const loadCatData = useCallback(async () => {
    if (!activeConnection) return;
    setCatLoading(true);
    try {
      const { esRequest } = await import("../services/client");
      const endpoint = catIndexFilter
        ? `/_cat/${catEndpoint}/${encodeURIComponent(catIndexFilter)}?format=json`
        : `/_cat/${catEndpoint}?format=json`;
      const data = await esRequest<any[]>(activeConnection, endpoint);
      if (Array.isArray(data) && data.length > 0) {
        setCatColumns(Object.keys(data[0]));
        setCatData(data);
      } else {
        setCatColumns([]);
        setCatData([]);
      }
    } catch (err) {
      logError(err, { source: "clusterInfo.loadCat", message: `Failed to load _cat/${catEndpoint}` });
      setCatColumns([]);
      setCatData([]);
    } finally {
      setCatLoading(false);
    }
  }, [activeConnection, catEndpoint, catIndexFilter, t]);

  const loadNodeStats = useCallback(async () => {
    if (!activeConnection) return;
    setStatsLoading(true);
    try {
      const { esRequest } = await import("../services/client");
      const data = await esRequest<any>(activeConnection, "/_nodes/stats");
      const nodes: Array<Record<string, unknown>> = [];
      if (data?.nodes) {
        for (const [id, node] of Object.entries(data.nodes)) {
          const n = node as any;
          nodes.push({
            id,
            name: n.name,
            host: n.host,
            ip: n.ip,
            roles: n.roles?.join(", ") || "",
            cpuPercent: n.os?.cpu?.percent ?? "-",
            memUsed: n.os?.mem?.used_in_bytes,
            memTotal: n.os?.mem?.total_in_bytes,
            load1m: n.os?.load_average?.["1m"],
            load5m: n.os?.load_average?.["5m"],
            load15m: n.os?.load_average?.["15m"],
          });
        }
      }
      setNodeStats(nodes);
    } catch (err) {
      logError(err, { source: "clusterInfo.loadNodeStats", message: "Failed to load node stats" });
    } finally {
      setStatsLoading(false);
    }
  }, [activeConnection, t]);

  useEffect(() => {
    loadClusterInfo();
  }, [loadClusterInfo]);

  useEffect(() => {
    loadNodeStats();
  }, [loadNodeStats]);

  useEffect(() => {
    loadCatData();
  }, [loadCatData]);

  const healthColor = (status?: string) => {
    switch (status) {
      case "green": return "#34c759";
      case "yellow": return "#ff9500";
      case "red": return "#ff3b30";
      default: return "#94a3b8";
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return "-";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    let val = bytes;
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
    return `${val.toFixed(1)} ${units[i]}`;
  };

  return (
    <div className="page" style={{ flex: 1, minHeight: 0 }}>
      {error && (
        <div className="tm-error-banner">
          <span className="text-danger">{error}</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setError("")}>{t("common.close")}</button>
        </div>
      )}

      {/* Cluster Info + Health */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", flex: "0 0 auto" }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{t("clusterInfo.clusterInfo")}</h3>
            <button className="btn btn-sm btn-ghost" onClick={loadClusterInfo}>{t("indexManager.refreshStatus")}</button>
          </div>
          <div className="card-body" style={{ padding: loading ? "16px" : "8px 16px" }}>
            {loading ? <p className="muted">{t("common.loading")}</p> : clusterInfo && (
              <div style={{ fontSize: "13px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "6px" }}>
                  <span className="muted">{t("clusterInfo.clusterName")}</span>
                  <strong>{String(clusterInfo.cluster_name || "-")}</strong>
                  <span className="muted">{t("clusterInfo.version")}</span>
                  <span>{esVersion?.number || String((clusterInfo.version as any)?.number || "-")}</span>
                  <span className="muted">{t("clusterInfo.luceneVersion")}</span>
                  <span>{esVersion?.luceneVersion || String((clusterInfo.version as any)?.lucene_version || "-")}</span>
                  <span className="muted">{t("clusterInfo.buildFlavor")}</span>
                  <span>{String((clusterInfo.version as any)?.build_flavor || "-")}</span>
                  <span className="muted">{t("clusterInfo.tagline")}</span>
                  <span>{String(clusterInfo.tagline || "-")}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{t("clusterInfo.clusterHealth")}</h3>
          </div>
          <div className="card-body" style={{ padding: "8px 16px" }}>
            {clusterHealth && (
              <div style={{ fontSize: "13px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "6px" }}>
                  <span className="muted">{t("clusterInfo.status")}</span>
                  <span>
                    <span style={{
                      display: "inline-block", width: "10px", height: "10px", borderRadius: "50%",
                      background: healthColor(clusterHealth.status as string), marginRight: "8px"
                    }} />
                    <span style={{ textTransform: "capitalize" }}>{String(clusterHealth.status || "-")}</span>
                  </span>
                  <span className="muted">{t("clusterInfo.numberOfNodes")}</span>
                  <span>{String(clusterHealth.number_of_nodes ?? "-")}</span>
                  <span className="muted">{t("clusterInfo.activePrimaryShards")}</span>
                  <span>{String(clusterHealth.active_primary_shards ?? "-")}</span>
                  <span className="muted">{t("clusterInfo.activeShards")}</span>
                  <span>{String(clusterHealth.active_shards ?? "-")}</span>
                  <span className="muted">{t("clusterInfo.unassignedShards")}</span>
                  <span>{String(clusterHealth.unassigned_shards ?? "-")}</span>
                  <span className="muted">{t("clusterInfo.activeShardsPercent")}</span>
                  <span>{clusterHealth.active_shards_percent_as_number ? `${Number(clusterHealth.active_shards_percent_as_number).toFixed(1)}%` : "-"}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Node Statistics */}
      <div className="card" style={{ marginBottom: "24px", display: "flex", flexDirection: "column" }}>
        <div className="card-header">
          <h3 className="card-title">{t("clusterInfo.nodeStats")}</h3>
          <button className="btn btn-sm btn-ghost" onClick={loadNodeStats}>{t("indexManager.refreshStatus")}</button>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {statsLoading ? (
            <div style={{ padding: "24px", textAlign: "center" }} className="muted">{t("common.loading")}</div>
          ) : (
            <div className="table-wrapper" style={{ maxHeight: "140px" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("clusterInfo.nodeName")}</th>
                    <th>{t("clusterInfo.ip")}</th>
                    <th>{t("clusterInfo.roles")}</th>
                    <th>CPU %</th>
                    <th>{t("clusterInfo.memory")}</th>
                    <th>{t("clusterInfo.load")}</th>
                  </tr>
                </thead>
                <tbody>
                  {nodeStats.map((node) => (
                    <tr key={String(node.id)}>
                      <td style={{ fontWeight: 500 }}>{String(node.name || "-")}</td>
                      <td>{String(node.ip || "-")}</td>
                      <td>{String(node.roles || "-")}</td>
                      <td>{node.cpuPercent !== "-" ? `${node.cpuPercent}%` : "-"}</td>
                      <td>{node.memUsed && node.memTotal ? `${formatBytes(node.memUsed as number)} / ${formatBytes(node.memTotal as number)}` : "-"}</td>
                      <td>{node.load1m != null ? `${node.load1m} / ${node.load5m} / ${node.load15m}` : "-"}</td>
                    </tr>
                  ))}
                  {nodeStats.length === 0 && (
                    <tr>
                      <td colSpan={6} className="muted" style={{ textAlign: "center", padding: "24px" }}>{t("clusterInfo.noNodes")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Cat API Browser */}
      <div className="card" style={{ display: "flex", flexDirection: "column", maxHeight: "300px" }}>
        <div className="card-header" style={{ flex: "0 0 auto" }}>
          <h3 className="card-title">{t("clusterInfo.catApi")}</h3>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <select
              className="form-control"
              value={catEndpoint}
              onChange={(e) => setCatEndpoint(e.target.value)}
              style={{ width: "160px" }}
            >
              {CAT_ENDPOINTS.map((ep) => <option key={ep} value={ep}>{ep}</option>)}
            </select>
            <input
              className="form-control"
              value={catIndexFilter}
              onChange={(e) => setCatIndexFilter(e.target.value)}
              placeholder={t("clusterInfo.indexFilter")}
              style={{ width: "160px" }}
            />
            <button className="btn btn-sm btn-ghost" onClick={loadCatData}>{t("indexManager.refreshStatus")}</button>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          {catLoading ? (
            <div style={{ padding: "24px", textAlign: "center" }} className="muted">{t("common.loading")}</div>
          ) : (
            <div className="table-wrapper" style={{ borderRadius: 0, border: "none" }}>
              <table className="table">
                <thead>
                  <tr>
                    {catColumns.map((col) => <th key={col}>{col}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {catData.map((row, i) => (
                    <tr key={i}>
                      {catColumns.map((col) => <td key={col}>{String(row[col] ?? "-")}</td>)}
                    </tr>
                  ))}
                  {catData.length === 0 && (
                    <tr>
                      <td colSpan={Math.max(catColumns.length, 1)} className="muted" style={{ textAlign: "center", padding: "24px" }}>
                        {t("clusterInfo.noData")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
