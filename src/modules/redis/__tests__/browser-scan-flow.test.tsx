import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { RedisKeyDetail, RedisKeySummary } from "../types";
import { useRedisScanKeys } from "../features/browser/hooks/useRedisScanKeys";

const scanRedisKeysMock = vi.fn();

vi.mock("../features/browser/services/queryService", () => ({
  scanRedisKeys: (...args: unknown[]) => scanRedisKeysMock(...args),
}));

describe("useRedisScanKeys", () => {
  it("loads scan results and refreshes the selected key detail", async () => {
    scanRedisKeysMock.mockResolvedValueOnce({
      nextCursor: "8",
      hasMore: true,
      items: [
        { name: "user:1", keyType: "string", ttlMs: 5000 },
        { name: "user:2", keyType: "hash", ttlMs: null },
      ],
    });

    const refreshKeyDetail = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => {
      const [scannedKeys, setScannedKeys] = useState<RedisKeySummary[]>([]);
      const [nextCursor, setNextCursor] = useState("0");
      const [hasMoreKeys, setHasMoreKeys] = useState(false);
      const [selectedKey, setSelectedKey] = useState<string | null>(null);
      const [selectedKeyDetail, setSelectedKeyDetail] = useState<RedisKeyDetail | null>({
        name: "stale",
        keyType: "string",
        ttlMs: null,
        value: "old",
        truncated: false,
        unsupported: false,
      });
      const [error, setError] = useState("");

      return {
        scannedKeys,
        nextCursor,
        hasMoreKeys,
        selectedKey,
        selectedKeyDetail,
        error,
        actions: useRedisScanKeys({
          connectionId: "redis-1",
          currentDatabase: 2,
          keyPattern: "user",
          nextCursor,
          selectedKey,
          setScannedKeys,
          setNextCursor,
          setHasMoreKeys,
          setSelectedKey,
          setSelectedKeyDetail,
          refreshKeyDetail,
          setError,
        }),
      };
    });

    await act(async () => {
      await result.current.actions.refreshKeys(true);
    });

    expect(scanRedisKeysMock).toHaveBeenCalledWith("redis-1", 2, "user", "0", 100);
    expect(result.current.scannedKeys).toEqual([
      { name: "user:1", keyType: "string", ttlMs: 5000 },
      { name: "user:2", keyType: "hash", ttlMs: null },
    ]);
    expect(result.current.nextCursor).toBe("8");
    expect(result.current.hasMoreKeys).toBe(true);
    expect(result.current.selectedKey).toBe("user:1");
    expect(result.current.selectedKeyDetail).toBeNull();
    expect(refreshKeyDetail).toHaveBeenCalledWith("user:1");
    expect(result.current.error).toBe("");
  });

  it("stores the service error when scan fails", async () => {
    scanRedisKeysMock.mockRejectedValueOnce(new Error("scan failed"));

    const refreshKeyDetail = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => {
      const [, setScannedKeys] = useState<RedisKeySummary[]>([]);
      const [nextCursor, setNextCursor] = useState("0");
      const [, setHasMoreKeys] = useState(false);
      const [selectedKey, setSelectedKey] = useState<string | null>(null);
      const [, setSelectedKeyDetail] = useState<RedisKeyDetail | null>(null);
      const [error, setError] = useState("");

      return {
        error,
        actions: useRedisScanKeys({
          connectionId: "redis-1",
          currentDatabase: 0,
          keyPattern: "user",
          nextCursor,
          selectedKey,
          setScannedKeys,
          setNextCursor,
          setHasMoreKeys,
          setSelectedKey,
          setSelectedKeyDetail,
          refreshKeyDetail,
          setError,
        }),
      };
    });

    await act(async () => {
      await result.current.actions.refreshKeys(true);
    });

    expect(result.current.error).toBe("scan failed");
  });
});
