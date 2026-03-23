import { useCallback, useState } from "react";
import { logError } from "../../../../../lib/errorLog";
import type { RedisConnection, RedisKeyDetail, RedisSetKeyRequest } from "../../../types";
import { isEditableKeyType } from "../../../utils";
import { saveRedisBrowserKey } from "../services/mutationService";
import type { RedisBrowserEditorMode } from "../types";

interface UseRedisKeyEditorProps {
  activeRedisConnection: RedisConnection | null;
  currentDatabase: number;
  selectedKeyDetail: RedisKeyDetail | null;
  refreshDatabases: () => Promise<void>;
  refreshKeys: (reset: boolean, preferredKey?: string | null) => Promise<void>;
}

export function useRedisKeyEditor({
  activeRedisConnection,
  currentDatabase,
  selectedKeyDetail,
  refreshDatabases,
  refreshKeys,
}: UseRedisKeyEditorProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<RedisBrowserEditorMode>("create");
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorError, setEditorError] = useState("");

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setEditorError("");
    setEditorSaving(false);
  }, []);

  const openCreateEditor = useCallback(() => {
    setEditorMode("create");
    setEditorError("");
    setEditorOpen(true);
  }, []);

  const openEditEditor = useCallback(() => {
    if (!selectedKeyDetail || !isEditableKeyType(selectedKeyDetail.keyType)) {
      return;
    }

    setEditorMode("edit");
    setEditorError("");
    setEditorOpen(true);
  }, [selectedKeyDetail]);

  const handleSaveEditor = useCallback(async (request: RedisSetKeyRequest) => {
    if (!activeRedisConnection) {
      return;
    }

    setEditorSaving(true);
    setEditorError("");

    try {
      await saveRedisBrowserKey(activeRedisConnection.id, currentDatabase, request);
      closeEditor();
      await refreshDatabases();
      await refreshKeys(true, request.key);
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
  }, [activeRedisConnection, closeEditor, currentDatabase, editorMode, refreshDatabases, refreshKeys]);

  return {
    editorOpen,
    editorMode,
    editorSaving,
    editorError,
    closeEditor,
    openCreateEditor,
    openEditEditor,
    handleSaveEditor,
  };
}
