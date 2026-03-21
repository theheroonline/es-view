import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { logError } from "../../../lib/errorLog";
import { useRedisContext } from "../../../state/RedisContext";
import { RedisKeyDeleteModal } from "../components/RedisKeyDeleteModal";
import { RedisKeyDetailValue } from "../components/RedisKeyDetailValue";
import { RedisKeyEditorModal } from "../components/RedisKeyEditorModal";
import { RedisKeyTtlModal } from "../components/RedisKeyTtlModal";
import { redisDeleteKey, redisDeleteKeys, redisGetKeyDetail, redisListDatabases, redisScanKeys, redisSetKey, redisUpdateKeyTtl } from "../services/client";
import type { RedisSetKeyRequest } from "../types";
import { isEditableKeyType } from "../utils";

export default function RedisBrowserPage() {
  const { t } = useTranslation();
  const {
    activeRedisConnection,
    databases,
    setDatabases,
    selectedDatabase,
    setSelectedDatabase,
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
  } = useRedisContext();
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [scanCount, setScanCount] = useState(100);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorError, setEditorError] = useState("");
  const [ttlModalOpen, setTtlModalOpen] = useState(false);
  const [ttlSaving, setTtlSaving] = useState(false);
  const [ttlError, setTtlError] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteTargets, setDeleteTargets] = useState<string[]>([]);
  const [liveTtlMs, setLiveTtlMs] = useState<number | null>(null);
  const [error, setError] = useState("");

  const currentDatabase = selectedDatabase ?? activeRedisConnection?.database ?? 0;

  const loadDatabases = useCallback(async () => {
    if (!activeRedisConnection) {
      return;
    }

    setError("");
    try {
      const items = await redisListDatabases(activeRedisConnection.id);
      setDatabases(items);
      if (selectedDatabase === null) {
        setSelectedDatabase(activeRedisConnection.database);
      }
    } catch (err) {
      logError(err, {
        source: "redisBrowser.loadDatabases",
        message: `Failed to load Redis databases for ${activeRedisConnection.name}`
      });
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [activeRedisConnection, selectedDatabase, setDatabases, setSelectedDatabase]);

  const loadKeyDetail = useCallback(async (key: string) => {
    if (!activeRedisConnection) {
      return;
    }

    setLoadingDetail(true);
    setError("");
    try {
      const detail = await redisGetKeyDetail(activeRedisConnection.id, currentDatabase, key);
      setSelectedKey(key);
      setSelectedKeyDetail(detail);
    } catch (err) {
      logError(err, {
        source: "redisBrowser.loadKeyDetail",
        message: `Failed to load Redis key detail ${key}`
      });
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingDetail(false);
    }
  }, [activeRedisConnection, currentDatabase, setSelectedKey, setSelectedKeyDetail]);

  const loadKeys = useCallback(async (reset: boolean, preferredKey?: string | null) => {
    if (!activeRedisConnection) {
      return;
    }

    setLoadingKeys(true);
    setError("");
    try {
      // 自动在搜索值前后加 *，如果前后已有 * 则不加
      let searchPattern = keyPattern || "*";
      if (searchPattern !== "*") {
        if (!searchPattern.startsWith("*")) {
          searchPattern = "*" + searchPattern;
        }
        if (!searchPattern.endsWith("*")) {
          searchPattern = searchPattern + "*";
        }
      }

      const result = await redisScanKeys(
        activeRedisConnection.id,
        currentDatabase,
        searchPattern,
        reset ? "0" : nextCursor,
        scanCount,
      );

      const nextItems = result.items;
      const nextNames = new Set(nextItems.map((item) => item.name));
      const nextSelectedKey = preferredKey ?? (nextNames.has(selectedKey ?? "") ? selectedKey : result.items[0]?.name ?? null);

      setScannedKeys(nextItems);
      setNextCursor(result.nextCursor);
      setHasMoreKeys(result.hasMore);
      setSelectedKey(nextSelectedKey);
      setSelectedKeyDetail(null);

      if (nextSelectedKey) {
        void loadKeyDetail(nextSelectedKey);
      }
    } catch (err) {
      logError(err, {
        source: "redisBrowser.loadKeys",
        message: `Failed to scan Redis keys in DB ${currentDatabase}`
      });
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingKeys(false);
    }
  }, [activeRedisConnection, currentDatabase, keyPattern, nextCursor, scanCount, selectedKey, setScannedKeys, setNextCursor, setHasMoreKeys, setSelectedKey, setSelectedKeyDetail, loadKeyDetail]);

  useEffect(() => {
    if (!activeRedisConnection) {
      return;
    }

    void loadDatabases();
  }, [activeRedisConnection?.id]);

  useEffect(() => {
    if (!activeRedisConnection) {
      return;
    }

    // 切换数据库或批次大小时自动加载数据（用 * 搜索全部）
    void loadKeys(true);
  }, [activeRedisConnection?.id, currentDatabase, scanCount]);

  useEffect(() => {
    if (!activeRedisConnection) {
      return;
    }

    // 搜索框变动时自动搜索
    void loadKeys(true);
  }, [keyPattern]);

  useEffect(() => {
    setLiveTtlMs(selectedKeyDetail?.ttlMs ?? null);
  }, [selectedKeyDetail?.name, selectedKeyDetail?.ttlMs]);

  useEffect(() => {
    if (liveTtlMs === null || liveTtlMs <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setLiveTtlMs((current) => {
        if (current === null) {
          return null;
        }

        return current <= 1000 ? 0 : current - 1000;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [liveTtlMs]);

  const databaseOptions = useMemo(() => {
    if (databases.length > 0) {
      return databases;
    }

    return [{ index: currentDatabase, label: `DB${currentDatabase}`, keyCount: undefined, isDefault: true }];
  }, [databases, currentDatabase]);

  const ttlButtonValue = liveTtlMs === null ? -1 : Math.max(0, Math.ceil(liveTtlMs / 1000));

  const closeEditor = () => {
    setEditorOpen(false);
    setEditorError("");
    setEditorSaving(false);
  };

  const openCreateEditor = () => {
    setEditorMode("create");
    setEditorError("");
    setEditorOpen(true);
  };

  const openEditEditor = () => {
    if (!selectedKeyDetail || !isEditableKeyType(selectedKeyDetail.keyType)) {
      return;
    }

    setEditorMode("edit");
    setEditorError("");
    setEditorOpen(true);
  };

  const handleSaveEditor = async (request: RedisSetKeyRequest) => {
    if (!activeRedisConnection) {
      return;
    }

    setEditorSaving(true);
    setEditorError("");

    try {
      await redisSetKey(activeRedisConnection.id, currentDatabase, request);
      closeEditor();
      await loadDatabases();
      await loadKeys(true, request.key);
    } catch (err) {
      logError(err, {
        source: "redisBrowser.saveKey",
        message: `Failed to save Redis key ${request.key}`,
        detail: { mode: editorMode, database: currentDatabase, keyType: request.keyType }
      });
      setEditorError(err instanceof Error ? err.message : String(err));
    } finally {
      setEditorSaving(false);
    }
  };

  const closeTtlModal = () => {
    setTtlModalOpen(false);
    setTtlError("");
    setTtlSaving(false);
  };

  const handleSaveTtl = async (ttlMs: number | null) => {
    if (!activeRedisConnection || !selectedKeyDetail) {
      return;
    }

    const keyName = selectedKeyDetail.name;
    setTtlSaving(true);
    setTtlError("");

    try {
      await redisUpdateKeyTtl(activeRedisConnection.id, currentDatabase, {
        key: keyName,
        ttlMs,
      });
      closeTtlModal();
      await loadDatabases();
      await loadKeys(true, keyName);
    } catch (err) {
      logError(err, {
        source: "redisBrowser.updateTtl",
        message: `Failed to update Redis TTL ${keyName}`,
        detail: { database: currentDatabase, ttlMs }
      });
      setTtlError(err instanceof Error ? err.message : String(err));
    } finally {
      setTtlSaving(false);
    }
  };

  const openDeleteModal = (keys: string[]) => {
    const validKeys = keys.filter(Boolean);
    if (validKeys.length === 0) {
      return;
    }

    setDeleteTargets(validKeys);
    setDeleteError("");
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setDeleteError("");
    setDeleteSaving(false);
    setDeleteTargets([]);
  };

  const handleDeleteKeys = async () => {
    if (!activeRedisConnection || deleteTargets.length === 0) {
      return;
    }

    setDeleteSaving(true);
    setDeleteError("");

    try {
      if (deleteTargets.length === 1) {
        await redisDeleteKey(activeRedisConnection.id, currentDatabase, deleteTargets[0]);
      } else {
        await redisDeleteKeys(activeRedisConnection.id, currentDatabase, deleteTargets);
      }

      const removedSelectedKey = selectedKey !== null && deleteTargets.includes(selectedKey);
      closeDeleteModal();
      if (removedSelectedKey) {
        setSelectedKey(null);
        setSelectedKeyDetail(null);
      }
      await loadDatabases();
      await loadKeys(true, removedSelectedKey ? undefined : selectedKey);
    } catch (err) {
      logError(err, {
        source: "redisBrowser.deleteKeys",
        message: `Failed to delete Redis keys (${deleteTargets.length})`,
        detail: { database: currentDatabase, keys: deleteTargets }
      });
      setDeleteError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleteSaving(false);
    }
  };

  if (!activeRedisConnection) {
    return (
      <div className="card">
        <div className="muted">{t("redis.browser.noConnection")}</div>
      </div>
    );
  }

  return (
    <div className="redis-browser-grid">
      <div className="card redis-browser-panel">
        <div className="redis-browser-toolbar">
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <select className="form-control redis-db-select" value={currentDatabase} onChange={(event) => setSelectedDatabase(Number(event.target.value))}>
              {databaseOptions.map((item) => (
                <option key={item.index} value={item.index}>
                  {item.label}{typeof item.keyCount === "number" ? ` (${item.keyCount})` : ""}
                </option>
              ))}
            </select>
            <button className="btn btn-primary redis-btn-sm" onClick={openCreateEditor} title={t("common.new")}>
              {t("common.new")}
            </button>
          </div>
          <div style={{ display: "flex", gap: "12px", position: "relative" }}>
            <input
              className="form-control redis-search-input"
              value={keyPattern}
              onChange={(event) => setKeyPattern(event.target.value)}
              placeholder={t("redis.browser.patternPlaceholder")}
            />
            <button
              className="redis-search-button"
              onClick={() => void loadKeys(true)}
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
                    onClick={() => void loadKeyDetail(item.name)}
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
              onBlur={(e) => {
                const value = Math.max(1, parseInt(e.target.value) || 100);
                setScanCount(value);
              }}
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
          <button className="btn btn-primary redis-btn-sm" onClick={() => void loadKeys(false)} disabled={!hasMoreKeys || loadingKeys}>
            {t("redis.browser.nextBatch")}
          </button>
        </div>
      </div>

      <div className="card redis-browser-panel">
        <div className="card-header" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
              <h3 className="card-title">{t("redis.browser.detail")}</h3>
              {selectedKey && <div className="muted" style={{ fontSize: "12px", wordBreak: "break-all" }}>{selectedKey}</div>}
            </div>
            <div className="redis-detail-header-actions" style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
              {selectedKeyDetail && <button className="btn btn-ghost redis-ttl-button" onClick={() => setTtlModalOpen(true)} title={t("redis.browser.editTtl")}>TTL {ttlButtonValue}</button>}
              {selectedKeyDetail && isEditableKeyType(selectedKeyDetail.keyType) && <button className="btn btn-ghost" onClick={openEditEditor}>{t("common.edit")}</button>}
              {selectedKeyDetail && <button className="btn btn-ghost text-danger" onClick={() => openDeleteModal([selectedKeyDetail.name])}>{t("common.delete")}</button>}
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
