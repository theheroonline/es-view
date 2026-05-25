import { useCallback, useState, useEffect, useRef } from "react";
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
  const selectedKeyRef = useRef<string | null>(null);
  const detailRef = useRef<RedisKeyDetail | null>(null);
  const intervalRef = useRef<number | null>(null);
  const setSelectedKeyDetailRef = useRef(setSelectedKeyDetail);

  // Keep setSelectedKeyDetail ref up to date
  useEffect(() => {
    setSelectedKeyDetailRef.current = setSelectedKeyDetail;
  }, [setSelectedKeyDetail]);

  const refreshKeyDetail = useCallback(async (key: string) => {
    if (!connectionId) {
      return;
    }

    selectedKeyRef.current = key;
    setLoadingDetail(true);
    setError("");
    setSelectedKey(key);
    setSelectedKeyDetail(null);
    try {
      const detail = await loadRedisKeyDetail(connectionId, currentDatabase, key);
      detailRef.current = detail;
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

  // Auto-refresh TTL every second when a key is selected
  useEffect(() => {
    if (!selectedKeyRef.current || !connectionId) {
      // Clear interval if no key selected
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Set up interval to decrement TTL locally every second
    intervalRef.current = window.setInterval(() => {
      if (!detailRef.current || detailRef.current.ttlMs === null) {
        return;
      }

      // Decrement TTL by 1 second (1000ms)
      const newTtlMs = detailRef.current.ttlMs - 1000;

      // If TTL reaches 0 or below, stop updating
      if (newTtlMs < 0) {
        return;
      }

      // Update the ref and trigger re-render with a new object
      detailRef.current = {
        ...detailRef.current,
        ttlMs: newTtlMs,
      };
      setSelectedKeyDetailRef.current({ ...detailRef.current });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [connectionId]);

  return {
    loadingDetail,
    refreshKeyDetail,
  };
}

