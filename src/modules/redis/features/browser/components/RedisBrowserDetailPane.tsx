import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { RedisKeyDetailValue } from "../../../components/RedisKeyDetailValue";
import { isEditableKeyType, formatTtl } from "../../../utils";
import type { RedisBrowserDetailPaneProps } from "../types";

function RedisBrowserDetailHeader({
  hasSelection,
  selectedKeyDetail,
  onRefreshKey,
  onDeleteKey,
  onEditKey,
  onOpenTtl,
}: {
  hasSelection: boolean;
  selectedKeyDetail?: { ttlMs: number | null } | null;
  onRefreshKey: () => void;
  onDeleteKey: () => void;
  onEditKey: () => void;
  onOpenTtl: () => void;
}) {
  const { t } = useTranslation();

  const ttlDisplay = useMemo(() => {
    if (!selectedKeyDetail) return "TTL";
    return `TTL: ${formatTtl(selectedKeyDetail.ttlMs)}`;
  }, [selectedKeyDetail?.ttlMs]);

  return (
    <div className="card-header redis-detail-header">
      <h3 className="card-title">{t("redis.browser.detail")}</h3>
      <div className="redis-detail-header-actions">
        <button className="btn btn-ghost redis-ttl-button" onClick={onOpenTtl} disabled={!hasSelection} title={t("redis.browser.editTtl")}>
          {ttlDisplay}
        </button>
        <button className="btn btn-ghost" onClick={onRefreshKey} disabled={!hasSelection} title={t("redis.browser.refreshKey")}>
          {t("redis.browser.refreshKey")}
        </button>
        <button className="btn btn-ghost" onClick={onEditKey} disabled={!hasSelection}>
          {t("common.edit")}
        </button>
        <button className="btn btn-ghost text-danger" onClick={onDeleteKey} disabled={!hasSelection}>
          {t("common.delete")}
        </button>
      </div>
    </div>
  );
}

const RedisBrowserDetailContent = memo(function RedisBrowserDetailContent({
  loadingDetail,
  selectedKey,
  selectedKeyDetail,
}: Pick<RedisBrowserDetailPaneProps, "loadingDetail" | "selectedKey" | "selectedKeyDetail">) {
  const { t } = useTranslation();

  const detailContent = useMemo(() => {
    if (!selectedKey) {
      return <div className="redis-detail-message-card muted">{t("redis.browser.noKeySelected")}</div>;
    }

    if (loadingDetail && !selectedKeyDetail) {
      return <div className="redis-detail-message-card muted">{t("common.loading")}</div>;
    }

    if (!selectedKeyDetail) {
      return <div className="redis-detail-message-card muted">{t("redis.browser.noKeySelected")}</div>;
    }

    return (
      <>
        {!isEditableKeyType(selectedKeyDetail.keyType) && <div className="redis-detail-warning text-warning">{t("redis.browser.editUnsupported")}</div>}
        {selectedKeyDetail.truncated && <div className="redis-detail-warning text-warning">{t("redis.browser.truncated")}</div>}
        <RedisKeyDetailValue detail={selectedKeyDetail} />
      </>
    );
  }, [loadingDetail, selectedKey, selectedKeyDetail, t]);

  return detailContent;
});

export function RedisBrowserDetailPane({
  loadingDetail,
  selectedKey,
  selectedKeyDetail,
  onRefreshKey,
  onDeleteKey,
  onEditKey,
  onOpenTtl,
}: RedisBrowserDetailPaneProps) {
  const { t } = useTranslation();
  const hasSelection = Boolean(selectedKey);

  return (
    <div className="card redis-browser-panel">
      <RedisBrowserDetailHeader
        hasSelection={hasSelection}
        selectedKeyDetail={selectedKeyDetail}
        onRefreshKey={onRefreshKey}
        onDeleteKey={onDeleteKey}
        onEditKey={onEditKey}
        onOpenTtl={() => {
          if (selectedKeyDetail) {
            onOpenTtl();
          }
        }}
      />

      <div className="redis-detail-key-bar muted">{selectedKey ?? t("redis.browser.noKeySelected")}</div>

      <div className="redis-detail-body">
        <RedisBrowserDetailContent
          loadingDetail={loadingDetail}
          selectedKey={selectedKey}
          selectedKeyDetail={selectedKeyDetail}
        />
      </div>
    </div>
  );
}
