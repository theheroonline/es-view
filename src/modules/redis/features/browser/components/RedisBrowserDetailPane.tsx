import { RedisKeyDetailValue } from "../../../components/RedisKeyDetailValue";
import { isEditableKeyType } from "../../../utils";
import type { RedisBrowserDetailPaneProps } from "../types";

export function RedisBrowserDetailPane({
  loadingDetail,
  selectedKey,
  selectedKeyDetail,
  t,
  ttlButtonValue,
  onDeleteKey,
  onEditKey,
  onOpenTtl,
}: RedisBrowserDetailPaneProps) {
  return (
    <div className="card redis-browser-panel">
      <div className="card-header" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
            <h3 className="card-title">{t("redis.browser.detail")}</h3>
            {selectedKey && <div className="muted" style={{ fontSize: "12px", wordBreak: "break-all" }}>{selectedKey}</div>}
          </div>
          <div className="redis-detail-header-actions" style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
            {selectedKeyDetail && <button className="btn btn-ghost redis-ttl-button" onClick={onOpenTtl} title={t("redis.browser.editTtl")}>TTL {ttlButtonValue}</button>}
            {selectedKeyDetail && isEditableKeyType(selectedKeyDetail.keyType) && <button className="btn btn-ghost" onClick={onEditKey}>{t("common.edit")}</button>}
            {selectedKeyDetail && <button className="btn btn-ghost text-danger" onClick={() => onDeleteKey([selectedKeyDetail.name])}>{t("common.delete")}</button>}
          </div>
        </div>
      </div>

      <div className="redis-detail-body">
        {selectedKey && loadingDetail && <div className="muted">{t("common.loading")}</div>}
        {selectedKeyDetail && !isEditableKeyType(selectedKeyDetail.keyType) && <div className="text-warning">{t("redis.browser.editUnsupported")}</div>}
        {selectedKeyDetail && (
          <>
            {selectedKeyDetail.truncated && <div className="text-warning">{t("redis.browser.truncated")}</div>}
            <RedisKeyDetailValue detail={selectedKeyDetail} />
          </>
        )}
      </div>
    </div>
  );
}
