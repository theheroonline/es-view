import type { TFunction } from "i18next";

interface EsDataBrowserToolbarProps {
  indices: string[];
  loading: boolean;
  selectedIndex?: string;
  t: TFunction;
  onExecute: () => void;
  onSelectIndex: (index: string) => void;
  onShowFilters: () => void;
}

export function EsDataBrowserToolbar({
  indices,
  loading,
  selectedIndex,
  t,
  onExecute,
  onSelectIndex,
  onShowFilters,
}: EsDataBrowserToolbarProps) {
  return (
    <div className="card" style={{ flex: "0 0 auto" }}>
      <div className="card-body" style={{ display: "grid", gap: "12px" }}>
        <div className="module-toolbar-grid" style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
          <div className="module-toolbar-field" style={{ flex: "0 0 auto" }}>
            <label>{t("dataBrowser.selectIndex")}</label>
            <div style={{ position: "relative", display: "flex", alignItems: "center", width: "200px" }}>
              <select
                className="form-control"
                value={selectedIndex ?? ""}
                onChange={(event) => onSelectIndex(event.target.value)}
                style={{ paddingRight: selectedIndex ? "30px" : "12px" }}
              >
                <option value="">{t("dataBrowser.selectIndexPlaceholder")}</option>
                {indices
                  .filter((item) => !item.startsWith("."))
                  .sort()
                  .map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
              </select>
              {selectedIndex && (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectIndex("");
                  }}
                  className="btn-clear"
                  style={{
                    position: "absolute",
                    right: "24px",
                    background: "none",
                    border: "none",
                    color: "#86868b",
                    cursor: "pointer",
                    fontSize: "12px",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                  title={t("common.clear")}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn btn-primary btn-sm" onClick={onExecute} disabled={loading}>
              <span>{loading ? "⏳" : "🔍"}</span> {loading ? t("dataBrowser.querying") : t("dataBrowser.query")}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onShowFilters} disabled={loading}>
              <span>🔎</span> {t("dataBrowser.filter")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
