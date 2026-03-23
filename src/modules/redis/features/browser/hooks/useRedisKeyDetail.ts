import { useCallback, useState } from "react";
import { logError } from "../../../../../lib/errorLog";
import type { RedisKeyDetail } from "../../../types";
import { loadRedisKeyDetail } from "../services/queryService";

interface UseRedisKeyDetailProps {
  connectionId: string | null | undefined;
  currentDatabase: number;
  setSelectedKey: (key: string | null) => void;
  setSelectedKeyDetail: (detail: RedisKeyDetail | null) => void;
  setError: (message: string) => void;
}

export function useRedisKeyDetail({
  connectionId,
  currentDatabase,
  setSelectedKey,
  setSelectedKeyDetail,
  setError,
}: UseRedisKeyDetailProps) {
  const [loadingDetail, setLoadingDetail] = useState(false);

  const refreshKeyDetail = useCallback(async (key: string) => {
    if (!connectionId) {
      return;
    }

    setLoadingDetail(true);
    setError("");
    try {
      const detail = await loadRedisKeyDetail(connectionId, currentDatabase, key);
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
  }, [connectionId, currentDatabase, setError, setSelectedKey, setSelectedKeyDetail]);

  return {
    loadingDetail,
    refreshKeyDetail,
  };
}
