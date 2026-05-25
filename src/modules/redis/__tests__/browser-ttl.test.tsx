import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import type { RedisKeyDetail } from "../types";
import { useRedisKeyTtl } from "../features/browser/hooks/useRedisKeyTtl";

const updateRedisBrowserKeyTtlMock = vi.fn();

vi.mock("../features/browser/services/mutationService", () => ({
  updateRedisBrowserKeyTtl: (...args: unknown[]) => updateRedisBrowserKeyTtlMock(...args),
}));

describe("useRedisKeyTtl", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts down ttl button value over time", () => {
    vi.useFakeTimers();

    const selectedKeyDetail: RedisKeyDetail = {
      name: "user:1",
      keyType: "string",
      ttlMs: 2500,
      value: "Alice",
      truncated: false,
      unsupported: false,
    };

    const { result } = renderHook(() => useRedisKeyTtl({
      activeRedisConnection: {
        id: "redis-1",
        name: "cache",
        engine: "redis",
        host: "127.0.0.1",
        port: 6379,
        database: 0,
      },
      currentDatabase: 0,
      selectedKeyDetail,
      refreshDatabases: vi.fn().mockResolvedValue(undefined),
      refreshKeys: vi.fn().mockResolvedValue(undefined),
    }));

    expect(result.current.ttlButtonValue).toBe(3);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.ttlButtonValue).toBe(2);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.ttlButtonValue).toBe(0);
  });

  it("updates ttl and refreshes database plus key detail flow", async () => {
    updateRedisBrowserKeyTtlMock.mockResolvedValueOnce(undefined);

    const refreshDatabases = vi.fn().mockResolvedValue(undefined);
    const refreshKeys = vi.fn().mockResolvedValue(undefined);
    const selectedKeyDetail: RedisKeyDetail = {
      name: "user:1",
      keyType: "string",
      ttlMs: 5000,
      value: "Alice",
      truncated: false,
      unsupported: false,
    };

    const { result } = renderHook(() => useRedisKeyTtl({
      activeRedisConnection: {
        id: "redis-1",
        name: "cache",
        engine: "redis",
        host: "127.0.0.1",
        port: 6379,
        database: 0,
      },
      currentDatabase: 5,
      selectedKeyDetail,
      refreshDatabases,
      refreshKeys,
    }));

    await act(async () => {
      await result.current.handleSaveTtl(10000);
    });

    expect(updateRedisBrowserKeyTtlMock).toHaveBeenCalledWith("redis-1", 5, "user:1", 10000);
    expect(refreshDatabases).toHaveBeenCalledTimes(1);
    expect(refreshKeys).toHaveBeenCalledWith(true, "user:1");
    expect(result.current.ttlError).toBe("");
    expect(result.current.ttlSaving).toBe(false);
  });
});
