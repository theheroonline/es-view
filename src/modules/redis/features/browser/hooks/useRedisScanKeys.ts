import { useCallback, useState } from "react";
import { logError } from "../../../../../lib/errorLog";
import type { RedisKeyDetail, RedisKeySummary } from "../../../types";
import { scanRedisKeys } from "../services/queryService";

interface UseRedisScanKeysProps {
  connectionId: string | null | undefined;
  currentDatabase: number;
  keyPattern: string;
  nextCursor: string;
  selectedKey: string | null;
  setScannedKeys: (keys: RedisKeySummary[]) => void;
  setNextCursor: (cursor: string) => void;
  setHasMoreKeys: (hasMore: boolean) => void;
  setSelectedKey: (key: string | null) => void;
  setSelectedKeyDetail: (detail: RedisKeyDetail | null) => void;
  refreshKeyDetail: (key: string) => Promise<void>;
  setError: (message: string) => void;
}

export function useRedisScanKeys({
  connectionId,
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
}: UseRedisScanKeysProps) {
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [scanCount, setScanCount] = useState(100);

  const refreshKeys = useCallback(async (reset: boolean, preferredKey?: string | null) => {
    if (!connectionId) {
      return;
    }

    setLoadingKeys(true);
    setError("");
    try {
      const result = await scanRedisKeys(
        connectionId,
        currentDatabase,
        keyPattern,
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
        await refreshKeyDetail(nextSelectedKey);
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
  }, [connectionId, currentDatabase, keyPattern, nextCursor, refreshKeyDetail, scanCount, selectedKey, setError, setHasMoreKeys, setNextCursor, setScannedKeys, setSelectedKey, setSelectedKeyDetail]);

  return {
    loadingKeys,
    scanCount,
    setScanCount,
    refreshKeys,
  };
}
