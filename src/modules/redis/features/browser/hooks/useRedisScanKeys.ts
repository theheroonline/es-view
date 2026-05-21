import { useCallback, useEffect, useRef, useState } from "react";
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

  // All scan parameters stored in refs to prevent stale closures when
  // connection switches. The old callback might fire with outdated props.
  const connectionIdRef = useRef(connectionId);
  const currentDatabaseRef = useRef(currentDatabase);
  const keyPatternRef = useRef(keyPattern);
  const nextCursorRef = useRef(nextCursor);

  useEffect(() => { connectionIdRef.current = connectionId; }, [connectionId]);
  useEffect(() => { currentDatabaseRef.current = currentDatabase; }, [currentDatabase]);
  useEffect(() => { keyPatternRef.current = keyPattern; }, [keyPattern]);
  useEffect(() => { nextCursorRef.current = nextCursor; }, [nextCursor]);

  const refreshKeys = useCallback(async (reset: boolean, preferredKey?: string | null) => {
    const cid = connectionIdRef.current;
    const db = currentDatabaseRef.current;
    const pattern = keyPatternRef.current;
    const cursor = nextCursorRef.current;
    if (!cid) {
      return;
    }

    setLoadingKeys(true);
    setError("");
    try {
      const result = await scanRedisKeys(
        cid,
        db,
        pattern,
        reset ? "0" : cursor,
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
        message: `Failed to scan Redis keys in DB ${db}`
      });
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingKeys(false);
    }
  }, [refreshKeyDetail, scanCount, selectedKey, setError, setHasMoreKeys, setNextCursor, setScannedKeys, setSelectedKey, setSelectedKeyDetail]);

  return {
    loadingKeys,
    scanCount,
    setScanCount,
    refreshKeys,
  };
}
