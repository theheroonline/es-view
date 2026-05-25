import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RedisKeyDetail, RedisSetKeyRequest } from "../types";
import { useRedisKeyEditor } from "../features/browser/hooks/useRedisKeyEditor";

const saveRedisBrowserKeyMock = vi.fn();

vi.mock("../features/browser/services/mutationService", () => ({
  saveRedisBrowserKey: (...args: unknown[]) => saveRedisBrowserKeyMock(...args),
}));

describe("useRedisKeyEditor", () => {
  it("saves a key and refreshes browser data", async () => {
    saveRedisBrowserKeyMock.mockResolvedValueOnce(undefined);

    const refreshDatabases = vi.fn().mockResolvedValue(undefined);
    const refreshKeys = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => useRedisKeyEditor({
      activeRedisConnection: {
        id: "redis-1",
        name: "cache",
        engine: "redis",
        host: "127.0.0.1",
        port: 6379,
        database: 0,
      },
      currentDatabase: 3,
      selectedKeyDetail: null,
      refreshDatabases,
      refreshKeys,
    }));

    const request: RedisSetKeyRequest = {
      key: "user:1",
      keyType: "string",
      ttlMs: 1000,
      value: "Alice",
      overwrite: true,
    };

    act(() => {
      result.current.openCreateEditor();
    });

    await act(async () => {
      await result.current.handleSaveEditor(request);
    });

    expect(saveRedisBrowserKeyMock).toHaveBeenCalledWith("redis-1", 3, request);
    expect(refreshDatabases).toHaveBeenCalledTimes(1);
    expect(refreshKeys).toHaveBeenCalledWith(true, "user:1");
    expect(result.current.editorOpen).toBe(false);
    expect(result.current.editorError).toBe("");
  });

  it("only opens edit mode for editable key types", () => {
    const selectedKeyDetail: RedisKeyDetail = {
      name: "stream:1",
      keyType: "unknown",
      ttlMs: null,
      value: null,
      truncated: false,
      unsupported: true,
    };

    const { result } = renderHook(() => useRedisKeyEditor({
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

    act(() => {
      result.current.openEditEditor();
    });

    expect(result.current.editorOpen).toBe(false);
    expect(result.current.editorMode).toBe("create");
  });
});
