import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { RedisKeyDetail } from "../types";
import { useRedisKeyDelete } from "../features/browser/hooks/useRedisKeyDelete";

const deleteRedisBrowserKeysMock = vi.fn();

vi.mock("../features/browser/services/mutationService", () => ({
  deleteRedisBrowserKeys: (...args: unknown[]) => deleteRedisBrowserKeysMock(...args),
}));

describe("useRedisKeyDelete", () => {
  it("clears selected key state when deleting the active key", async () => {
    deleteRedisBrowserKeysMock.mockResolvedValueOnce(undefined);

    const refreshDatabases = vi.fn().mockResolvedValue(undefined);
    const refreshKeys = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => {
      const [selectedKey, setSelectedKey] = useState<string | null>("user:1");
      const [selectedKeyDetail, setSelectedKeyDetail] = useState<RedisKeyDetail | null>({
        name: "user:1",
        keyType: "string",
        ttlMs: null,
        value: "Alice",
        truncated: false,
        unsupported: false,
      });

      return {
        selectedKey,
        selectedKeyDetail,
        actions: useRedisKeyDelete({
          activeRedisConnection: {
            id: "redis-1",
            name: "cache",
            engine: "redis",
            host: "127.0.0.1",
            port: 6379,
            database: 0,
          },
          currentDatabase: 1,
          selectedKey,
          setSelectedKey,
          setSelectedKeyDetail,
          refreshDatabases,
          refreshKeys,
        }),
      };
    });

    act(() => {
      result.current.actions.openDeleteModal(["user:1"]);
    });

    await act(async () => {
      await result.current.actions.handleDeleteKeys();
    });

    expect(deleteRedisBrowserKeysMock).toHaveBeenCalledWith("redis-1", 1, ["user:1"]);
    expect(result.current.selectedKey).toBeNull();
    expect(result.current.selectedKeyDetail).toBeNull();
    expect(refreshDatabases).toHaveBeenCalledTimes(1);
    expect(refreshKeys).toHaveBeenCalledWith(true, undefined);
    expect(result.current.actions.deleteModalOpen).toBe(false);
  });

  it("keeps selection when deleting other keys", async () => {
    deleteRedisBrowserKeysMock.mockResolvedValueOnce(undefined);

    const refreshDatabases = vi.fn().mockResolvedValue(undefined);
    const refreshKeys = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => {
      const [selectedKey, setSelectedKey] = useState<string | null>("user:1");
      const [selectedKeyDetail, setSelectedKeyDetail] = useState<RedisKeyDetail | null>({
        name: "user:1",
        keyType: "string",
        ttlMs: null,
        value: "Alice",
        truncated: false,
        unsupported: false,
      });

      return {
        selectedKey,
        selectedKeyDetail,
        actions: useRedisKeyDelete({
          activeRedisConnection: {
            id: "redis-1",
            name: "cache",
            engine: "redis",
            host: "127.0.0.1",
            port: 6379,
            database: 0,
          },
          currentDatabase: 1,
          selectedKey,
          setSelectedKey,
          setSelectedKeyDetail,
          refreshDatabases,
          refreshKeys,
        }),
      };
    });

    act(() => {
      result.current.actions.openDeleteModal(["temp:1"]);
    });

    await act(async () => {
      await result.current.actions.handleDeleteKeys();
    });

    expect(result.current.selectedKey).toBe("user:1");
    expect(result.current.selectedKeyDetail?.name).toBe("user:1");
    expect(refreshKeys).toHaveBeenCalledWith(true, "user:1");
  });
});
