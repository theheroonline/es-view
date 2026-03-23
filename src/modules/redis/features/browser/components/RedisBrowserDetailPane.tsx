import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { RedisKeyDetailValue } from "../../../components/RedisKeyDetailValue";
import { isEditableKeyType } from "../../../utils";
import type { RedisBrowserDetailPaneProps } from "../types";

const RedisBrowserDetailHeader = memo(function RedisBrowserDetailHeader({
  hasSelection,
  selectedKey,
  onRefreshKey,
  onDeleteKey,
  onEditKey,
  onOpenTtl,
}: {
  hasSelection: boolean;
  selectedKey: string | null;
  onRefreshKey: () => void;
  onDeleteKey: () => void;
  onEditKey: () => void;
  onOpenTtl: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="card-header redis-detail-header">
      <div className="redis-detail-header-main">
        <h3 className="card-title">{t("redis.browser.detail")}</h3>
        <div className="redis-detail-selected-key muted">{selectedKey ?? t("redis.browser.noKeySelected")}</div>
      </div>
      <div className="redis-detail-header-actions">
        <button className="btn btn-ghost redis-ttl-button" onClick={onOpenTtl} disabled={!hasSelection} title={t("redis.browser.editTtl")}>
          TTL
        </button>
        <button className="btn btn-ghost" onClick={onRefreshKey} disabled={!hasSelection} title={t("common.refresh")}>
          {t("common.refresh")}
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
});

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
  const hasSelection = Boolean(selectedKey);

  return (
    <div className="card redis-browser-panel">
      <RedisBrowserDetailHeader
        hasSelection={hasSelection}
        selectedKey={selectedKey}
        onRefreshKey={onRefreshKey}
        onDeleteKey={onDeleteKey}
        onEditKey={onEditKey}
        onOpenTtl={() => {
          if (selectedKeyDetail) {
            onOpenTtl();
          }
        }}
      />

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
