import type { RedisBrowserListPaneProps } from "../types";

export function RedisBrowserListPane({
  currentDatabase,
  databaseOptions,
  error,
  hasMoreKeys,
  keyPattern,
  loadingKeys,
  scanCount,
  scannedKeys,
  selectedKey,
  t,
  onChangeDatabase,
  onChangePattern,
  onChangeScanCount,
  onCreateKey,
  onLoadKeys,
  onSelectKey,
}: RedisBrowserListPaneProps) {
  return (
    <div className="card redis-browser-panel">
      <div className="redis-browser-toolbar">
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <select className="form-control redis-db-select" value={currentDatabase} onChange={(event) => onChangeDatabase(Number(event.target.value))}>
            {databaseOptions.map((item) => (
              <option key={item.index} value={item.index}>
                {item.label}{typeof item.keyCount === "number" ? ` (${item.keyCount})` : ""}
              </option>
            ))}
          </select>
          <button className="btn btn-primary redis-btn-sm" onClick={onCreateKey} title={t("common.new")}>
            {t("common.new")}
          </button>
        </div>
        <div style={{ display: "flex", gap: "12px", position: "relative" }}>
          <input
            className="form-control redis-search-input"
            value={keyPattern}
            onChange={(event) => onChangePattern(event.target.value)}
            placeholder={t("redis.browser.patternPlaceholder")}
          />
          <button
            className="redis-search-button"
            onClick={() => onLoadKeys(true)}
            disabled={loadingKeys}
            title={t("common.search")}
            style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)" }}
          >
            🔍
          </button>
        </div>
      </div>

      {error && <div className="redis-error-banner">{error}</div>}

      <div className="table-wrapper redis-key-table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>{t("redis.browser.key")}</th>
              <th style={{ textAlign: "center" }}>{t("redis.browser.type")}</th>
            </tr>
          </thead>
          <tbody>
            {scannedKeys.map((item) => (
              <tr
                key={item.name}
                className={selectedKey === item.name ? "redis-row-active" : undefined}
                onClick={() => onSelectKey(item.name)}
                style={{ cursor: "pointer" }}
              >
                <td style={{ wordBreak: "break-all" }}>{item.name}</td>
                <td style={{ textAlign: "center" }}><span className="pill">{item.keyType}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="redis-pagination">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "12px", color: "#556274" }}>每页</label>
          <input
            type="number"
            defaultValue={scanCount}
            onBlur={(event) => onChangeScanCount(Math.max(1, parseInt(event.target.value, 10) || 100))}
            style={{
              width: "60px",
              padding: "4px 8px",
              fontSize: "12px",
              border: "1px solid #d9e1ec",
              borderRadius: "4px",
              textAlign: "center"
            }}
            min="1"
          />
        </div>
        <button className="btn btn-primary redis-btn-sm" onClick={() => onLoadKeys(false)} disabled={!hasMoreKeys || loadingKeys}>
          {t("redis.browser.nextBatch")}
        </button>
      </div>
    </div>
  );
}
