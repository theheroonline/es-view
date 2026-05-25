import type { RedisBrowserListPaneProps } from "../types";
import { RedisKeyTree } from "./RedisKeyTree";

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
  const totalKeys = scannedKeys.length;

  return (
    <div className="card redis-browser-panel">
      <div className="redis-browser-toolbar">
        <div style={{ display: "flex", gap: "12px", alignItems: "center", minWidth: 0 }}>
          <select className="form-control redis-db-select" value={currentDatabase} onChange={(event) => onChangeDatabase(Number(event.target.value))}>
            {databaseOptions.map((item) => (
              <option key={item.index} value={item.index}>
                {item.label}{typeof item.keyCount === "number" ? ` (${item.keyCount})` : ""}
              </option>
            ))}
          </select>
          <button
            className="btn btn-ghost redis-btn-sm"
            onClick={() => onLoadKeys(true)}
            disabled={loadingKeys}
            title={t("common.refresh")}
            style={{ flexShrink: 0 }}
          >
            {t("common.refresh")}
          </button>
          <button className="btn btn-primary redis-btn-sm" onClick={onCreateKey} title={t("common.new")} style={{ flexShrink: 0 }}>
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

      <div className="redis-key-tree-container">
        {totalKeys === 0 && !loadingKeys && (
          <div className="redis-tree-empty-state">
            <div>{t("redis.browser.noKeys")}</div>
          </div>
        )}
        {totalKeys > 0 && (
          <RedisKeyTree
            keys={scannedKeys}
            selectedKey={selectedKey}
            onSelectKey={(key) => onSelectKey(key)}
          />
        )}
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
