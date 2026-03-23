import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRedisContext } from "../../../../../state/RedisContext";
import { RedisKeyDeleteModal } from "../../../components/RedisKeyDeleteModal";
import { RedisKeyEditorModal } from "../../../components/RedisKeyEditorModal";
import { RedisKeyTtlModal } from "../../../components/RedisKeyTtlModal";
import { useRedisBrowserState } from "../hooks/useRedisBrowserState";
import { useRedisDatabases } from "../hooks/useRedisDatabases";
import { useRedisKeyDelete } from "../hooks/useRedisKeyDelete";
import { useRedisKeyDetail } from "../hooks/useRedisKeyDetail";
import { useRedisKeyEditor } from "../hooks/useRedisKeyEditor";
import { useRedisKeyTtl } from "../hooks/useRedisKeyTtl";
import { useRedisScanKeys } from "../hooks/useRedisScanKeys";
import { RedisBrowserDetailPane } from "./RedisBrowserDetailPane";
import { RedisBrowserListPane } from "./RedisBrowserListPane";

export function RedisBrowserFeature() {
  const { t } = useTranslation();
  const { activeRedisConnection, selectedDatabase, setSelectedDatabase } = useRedisContext();
  const {
    databases,
    setDatabases,
    keyPattern,
    setKeyPattern,
    scannedKeys,
    setScannedKeys,
    nextCursor,
    setNextCursor,
    hasMoreKeys,
    setHasMoreKeys,
    selectedKey,
    setSelectedKey,
    selectedKeyDetail,
    setSelectedKeyDetail,
    error,
    setError,
    resetBrowserState,
  } = useRedisBrowserState();

  const currentDatabase = selectedDatabase ?? activeRedisConnection?.database ?? 0;

  const { loadingDetail, refreshKeyDetail } = useRedisKeyDetail({
    connectionId: activeRedisConnection?.id,
    currentDatabase,
    setSelectedKey,
    setSelectedKeyDetail,
    setError,
  });

  const { databaseOptions, refreshDatabases } = useRedisDatabases({
    activeRedisConnection,
    currentDatabase,
    databases,
    selectedDatabase,
    setDatabases,
    setSelectedDatabase,
    setError,
  });

  const { loadingKeys, scanCount, setScanCount, refreshKeys } = useRedisScanKeys({
    connectionId: activeRedisConnection?.id,
    currentDatabase,
    keyPattern,
    nextCursor,
    selectedKey,
    setScannedKeys,
    setNextCursor,
    setHasMoreKeys,
    setSelectedKey,
    setSelectedKeyDetail,
    refreshKeyDetail,
    setError,
  });

  const {
    editorOpen,
    editorMode,
    editorSaving,
    editorError,
    closeEditor,
    openCreateEditor,
    openEditEditor,
    handleSaveEditor,
  } = useRedisKeyEditor({
    activeRedisConnection,
    currentDatabase,
    selectedKeyDetail,
    refreshDatabases,
    refreshKeys,
  });

  const {
    ttlModalOpen,
    setTtlModalOpen,
    ttlSaving,
    ttlError,
    ttlButtonValue,
    closeTtlModal,
    handleSaveTtl,
  } = useRedisKeyTtl({
    activeRedisConnection,
    currentDatabase,
    selectedKeyDetail,
    refreshDatabases,
    refreshKeys,
  });

  const {
    deleteModalOpen,
    deleteSaving,
    deleteError,
    deleteTargets,
    openDeleteModal,
    closeDeleteModal,
    handleDeleteKeys,
  } = useRedisKeyDelete({
    activeRedisConnection,
    currentDatabase,
    selectedKey,
    setSelectedKey,
    setSelectedKeyDetail,
    refreshDatabases,
    refreshKeys,
  });

  useEffect(() => {
    resetBrowserState();
  }, [activeRedisConnection?.id, resetBrowserState]);

  useEffect(() => {
    if (!activeRedisConnection) {
      return;
    }

    void refreshDatabases();
  }, [activeRedisConnection?.id, refreshDatabases]);

  useEffect(() => {
    if (!activeRedisConnection) {
      return;
    }

    void refreshKeys(true);
  }, [activeRedisConnection?.id, currentDatabase, scanCount, refreshKeys]);

  useEffect(() => {
    if (!activeRedisConnection) {
      return;
    }

    void refreshKeys(true);
  }, [keyPattern, activeRedisConnection, refreshKeys]);


  if (!activeRedisConnection) {
    return (
      <div className="card">
        <div className="muted">{t("redis.browser.noConnection")}</div>
      </div>
    );
  }

  return (
    <div className="redis-browser-grid">
      <RedisBrowserListPane
        currentDatabase={currentDatabase}
        databaseOptions={databaseOptions}
        error={error}
        hasMoreKeys={hasMoreKeys}
        keyPattern={keyPattern}
        loadingKeys={loadingKeys}
        scanCount={scanCount}
        scannedKeys={scannedKeys}
        selectedKey={selectedKey}
        t={t}
        onChangeDatabase={setSelectedDatabase}
        onChangePattern={setKeyPattern}
        onChangeScanCount={setScanCount}
        onCreateKey={openCreateEditor}
        onLoadKeys={(reset) => {
          void refreshKeys(reset);
        }}
        onSelectKey={(key) => {
          void refreshKeyDetail(key);
        }}
      />

      <RedisBrowserDetailPane
        loadingDetail={loadingDetail}
        selectedKey={selectedKey}
        selectedKeyDetail={selectedKeyDetail}
        t={t}
        ttlButtonValue={ttlButtonValue}
        onDeleteKey={openDeleteModal}
        onEditKey={openEditEditor}
        onOpenTtl={() => setTtlModalOpen(true)}
      />

      <RedisKeyEditorModal
        open={editorOpen}
        mode={editorMode}
        detail={editorMode === "edit" ? selectedKeyDetail : null}
        loading={editorSaving}
        error={editorError}
        onClose={closeEditor}
        onSubmit={handleSaveEditor}
      />

      <RedisKeyTtlModal
        open={ttlModalOpen}
        currentTtlMs={selectedKeyDetail?.ttlMs ?? null}
        loading={ttlSaving}
        error={ttlError}
        onClose={closeTtlModal}
        onSubmit={handleSaveTtl}
      />

      <RedisKeyDeleteModal
        open={deleteModalOpen}
        keys={deleteTargets}
        loading={deleteSaving}
        error={deleteError}
        onClose={closeDeleteModal}
        onSubmit={handleDeleteKeys}
      />
    </div>
  );
}
