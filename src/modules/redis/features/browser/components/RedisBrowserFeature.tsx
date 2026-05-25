import { useCallback, useEffect, useRef } from "react";
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
import type { RedisDatabaseInfo, RedisKeySummary } from "../../../types";
import { RedisBrowserDetailPane } from "./RedisBrowserDetailPane";
import { RedisBrowserListPane } from "./RedisBrowserListPane";

// Module-level cache: persists Redis browser state per connection.
// Survives tab switches so the user sees the same keys, selected key,
// search pattern, etc. when they return to the Redis tab.
interface RedisBrowserCachedState {
  keyPattern: string;
  scannedKeys: RedisKeySummary[];
  selectedKey: string | null;
  currentDatabase: number;
  databases: RedisDatabaseInfo[];
  scanCount: number;
  nextCursor: string;
  hasMoreKeys: boolean;
}
const redisBrowserCache = new Map<string, RedisBrowserCachedState>();

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

  const activeRedisConnectionId = activeRedisConnection?.id;
  const selectedKeyRef = useRef(selectedKey);
  const selectedKeyDetailRef = useRef(selectedKeyDetail);
  const openEditEditorRef = useRef(openEditEditor);

  const refreshDatabasesRef = useRef(refreshDatabases);

  // Track previous connection ID to distinguish real connection changes
  // from tab switches (where the ID stays the same).
  const prevConnectionIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    selectedKeyRef.current = selectedKey;
  }, [selectedKey]);

  useEffect(() => {
    selectedKeyDetailRef.current = selectedKeyDetail;
  }, [selectedKeyDetail]);

  useEffect(() => {
    openEditEditorRef.current = openEditEditor;
  }, [openEditEditor]);

  useEffect(() => {
    refreshDatabasesRef.current = refreshDatabases;
  }, [refreshDatabases]);

  // Note: refreshKeysRef is kept for useRedisKeyEditor/useRedisKeyTtl/useRedisKeyDelete,
  // which need it for their internal callbacks. The connection switch fix is handled
  // inside useRedisScanKeys via connectionIdRef/currentDatabaseRef.

  // Save current state to cache on every change
  useEffect(() => {
    if (!activeRedisConnectionId) return;
    redisBrowserCache.set(activeRedisConnectionId, {
      keyPattern,
      scannedKeys,
      selectedKey,
      currentDatabase,
      databases,
      scanCount,
      nextCursor,
      hasMoreKeys,
    });
  }, [activeRedisConnectionId, keyPattern, scannedKeys, selectedKey, currentDatabase, databases, scanCount, nextCursor, hasMoreKeys]);

  // Connection change: restore from cache or reset
  useEffect(() => {
    const prevId = prevConnectionIdRef.current;
    prevConnectionIdRef.current = activeRedisConnectionId;

    // Same connection (tab switch) — do nothing, state is already preserved
    if (prevId === activeRedisConnectionId) return;

    // Disconnected
    if (!activeRedisConnectionId) {
      resetBrowserState();
      return;
    }

    // New connection — try cache restore
    const cached = redisBrowserCache.get(activeRedisConnectionId);
    if (cached) {
      setKeyPattern(cached.keyPattern);
      setScannedKeys(cached.scannedKeys);
      setSelectedKey(cached.selectedKey);
      setSelectedKeyDetail(null);
      setSelectedDatabase(cached.currentDatabase);
      setDatabases(cached.databases);
      setScanCount(cached.scanCount);
      setNextCursor(cached.nextCursor);
      setHasMoreKeys(cached.hasMoreKeys);
      // Don't skip scan — connection must always fetch fresh keys.
      // Cache restore only fills UI momentarily to avoid blank state.
      return;
    }

    // No cache — full reset
    resetBrowserState();

    // Always trigger fresh scan on connection change.
    // Cache restore fills UI momentarily to avoid blank state;
    // the auto-scan effect below will also fire because activeRedisConnectionId
    // changed, so we let it handle the scan instead of doing it here.
    // This avoids double-scanning.
  }, [activeRedisConnectionId, resetBrowserState, setSelectedDatabase, setDatabases, setNextCursor, setHasMoreKeys]);

  useEffect(() => {
    if (!activeRedisConnectionId) return;
    void refreshDatabasesRef.current();
  }, [activeRedisConnectionId]);

  useEffect(() => {
    if (!activeRedisConnectionId) return;
    void refreshKeys(true);
  }, [activeRedisConnectionId, currentDatabase, keyPattern, scanCount, refreshKeys]);

  const handleDeleteSelectedKey = useCallback(() => {
    const detail = selectedKeyDetailRef.current;
    if (!detail) {
      return;
    }
    openDeleteModal([detail.name]);
  }, [openDeleteModal]);

  const handleEditSelectedKey = useCallback(() => {
    if (!selectedKeyRef.current || !selectedKeyDetailRef.current) {
      return;
    }
    void openEditEditorRef.current();
  }, []);

  const handleOpenTtl = useCallback(() => {
    if (!selectedKeyRef.current || !selectedKeyDetailRef.current) {
      return;
    }
    setTtlModalOpen(true);
  }, [setTtlModalOpen]);

  const handleRefreshSelectedKey = useCallback(() => {
    const key = selectedKeyRef.current;
    if (!key) {
      return;
    }
    void refreshKeyDetail(key);
  }, [refreshKeyDetail]);


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
        onRefreshKey={handleRefreshSelectedKey}
        onDeleteKey={handleDeleteSelectedKey}
        onEditKey={handleEditSelectedKey}
        onOpenTtl={handleOpenTtl}
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
