import { useCallback, useEffect, useMemo, useState } from "react";
import { logError } from "../../../../../lib/errorLog";
import type { RedisConnection, RedisKeyDetail } from "../../../types";
import { updateRedisBrowserKeyTtl } from "../services/mutationService";

interface UseRedisKeyTtlProps {
  activeRedisConnection: RedisConnection | null;
  currentDatabase: number;
  selectedKeyDetail: RedisKeyDetail | null;
  refreshDatabases: () => Promise<void>;
  refreshKeys: (reset: boolean, preferredKey?: string | null) => Promise<void>;
}

export function useRedisKeyTtl({
  activeRedisConnection,
  currentDatabase,
  selectedKeyDetail,
  refreshDatabases,
  refreshKeys,
}: UseRedisKeyTtlProps) {
  const [ttlModalOpen, setTtlModalOpen] = useState(false);
  const [ttlSaving, setTtlSaving] = useState(false);
  const [ttlError, setTtlError] = useState("");
  const [liveTtlMs, setLiveTtlMs] = useState<number | null>(null);

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

  const ttlButtonValue = useMemo(() => {
    return liveTtlMs === null ? -1 : Math.max(0, Math.ceil(liveTtlMs / 1000));
  }, [liveTtlMs]);

  const closeTtlModal = useCallback(() => {
    setTtlModalOpen(false);
    setTtlError("");
    setTtlSaving(false);
  }, []);

  const handleSaveTtl = useCallback(async (ttlMs: number | null) => {
    if (!activeRedisConnection || !selectedKeyDetail) {
      return;
    }

    const keyName = selectedKeyDetail.name;
    setTtlSaving(true);
    setTtlError("");

    try {
      await updateRedisBrowserKeyTtl(activeRedisConnection.id, currentDatabase, keyName, ttlMs);
      closeTtlModal();
      await refreshDatabases();
      await refreshKeys(true, keyName);
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
  }, [activeRedisConnection, closeTtlModal, currentDatabase, refreshDatabases, refreshKeys, selectedKeyDetail]);

  return {
    ttlModalOpen,
    setTtlModalOpen,
    ttlSaving,
    ttlError,
    ttlButtonValue,
    closeTtlModal,
    handleSaveTtl,
  };
}
