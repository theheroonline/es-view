import { useCallback, useState } from "react";
import { logError } from "../../../../../lib/errorLog";
import type { RedisConnection, RedisKeyDetail } from "../../../types";
import { deleteRedisBrowserKeys } from "../services/mutationService";

interface UseRedisKeyDeleteProps {
  activeRedisConnection: RedisConnection | null;
  currentDatabase: number;
  selectedKey: string | null;
  setSelectedKey: (key: string | null) => void;
  setSelectedKeyDetail: (detail: RedisKeyDetail | null) => void;
  refreshDatabases: () => Promise<void>;
  refreshKeys: (reset: boolean, preferredKey?: string | null) => Promise<void>;
}

export function useRedisKeyDelete({
  activeRedisConnection,
  currentDatabase,
  selectedKey,
  setSelectedKey,
  setSelectedKeyDetail,
  refreshDatabases,
  refreshKeys,
}: UseRedisKeyDeleteProps) {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteTargets, setDeleteTargets] = useState<string[]>([]);

  const openDeleteModal = useCallback((keys: string[]) => {
    const validKeys = keys.filter(Boolean);
    if (validKeys.length === 0) {
      return;
    }

    setDeleteTargets(validKeys);
    setDeleteError("");
    setDeleteModalOpen(true);
  }, []);

  const closeDeleteModal = useCallback(() => {
    setDeleteModalOpen(false);
    setDeleteError("");
    setDeleteSaving(false);
    setDeleteTargets([]);
  }, []);

  const handleDeleteKeys = useCallback(async () => {
    if (!activeRedisConnection || deleteTargets.length === 0) {
      return;
    }

    setDeleteSaving(true);
    setDeleteError("");

    try {
      await deleteRedisBrowserKeys(activeRedisConnection.id, currentDatabase, deleteTargets);

      const removedSelectedKey = selectedKey !== null && deleteTargets.includes(selectedKey);
      closeDeleteModal();
      if (removedSelectedKey) {
        setSelectedKey(null);
        setSelectedKeyDetail(null);
      }
      await refreshDatabases();
      await refreshKeys(true, removedSelectedKey ? undefined : selectedKey);
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
  }, [activeRedisConnection, closeDeleteModal, currentDatabase, deleteTargets, refreshDatabases, refreshKeys, selectedKey, setSelectedKey, setSelectedKeyDetail]);

  return {
    deleteModalOpen,
    deleteSaving,
    deleteError,
    deleteTargets,
    openDeleteModal,
    closeDeleteModal,
    handleDeleteKeys,
  };
}
