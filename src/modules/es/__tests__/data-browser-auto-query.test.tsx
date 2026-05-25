import { act, renderHook } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useEsDataBrowserAutoQuery } from "../features/data-browser/hooks/useEsDataBrowserAutoQuery";

describe("useEsDataBrowserAutoQuery", () => {
  it("does not re-run the query when only the error handler identity changes", async () => {
    const executeQuery = vi.fn().mockResolvedValue({ hits: { total: 1 } });
    const onError = vi.fn();
    const setError = vi.fn();
    const setLoading = vi.fn();
    const setLoadingMessage = vi.fn();
    const setResult = vi.fn();

    const { rerender } = renderHook(
      ({ nextOnError }) => {
        const skipNextAutoQueryRef = useRef(false);

        useEsDataBrowserAutoQuery({
          activeConnectionId: "es-1",
          executeQuery,
          onError: nextOnError,
          page: 1,
          selectedIndex: "logs-2026",
          setError,
          setLoading,
          setLoadingMessage,
          setResult,
          size: 10,
          skipNextAutoQueryRef,
        });
      },
      {
        initialProps: { nextOnError: onError },
      }
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(executeQuery).toHaveBeenCalledTimes(1);

    rerender({ nextOnError: vi.fn() });

    await act(async () => {
      await Promise.resolve();
    });

    expect(executeQuery).toHaveBeenCalledTimes(1);
  });

  it("does not re-run the query when only the execute function identity changes", async () => {
    const firstExecuteQuery = vi.fn().mockResolvedValue({ hits: { total: 1 } });
    const onError = vi.fn();
    const setError = vi.fn();
    const setLoading = vi.fn();
    const setLoadingMessage = vi.fn();
    const setResult = vi.fn();

    const { rerender } = renderHook(
      ({ nextExecuteQuery }) => {
        const skipNextAutoQueryRef = useRef(false);

        useEsDataBrowserAutoQuery({
          activeConnectionId: "es-1",
          executeQuery: nextExecuteQuery,
          onError,
          page: 1,
          selectedIndex: "logs-2026",
          setError,
          setLoading,
          setLoadingMessage,
          setResult,
          size: 10,
          skipNextAutoQueryRef,
        });
      },
      {
        initialProps: { nextExecuteQuery: firstExecuteQuery },
      }
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(firstExecuteQuery).toHaveBeenCalledTimes(1);

    const secondExecuteQuery = vi.fn().mockResolvedValue({ hits: { total: 2 } });
    rerender({ nextExecuteQuery: secondExecuteQuery });

    await act(async () => {
      await Promise.resolve();
    });

    expect(firstExecuteQuery).toHaveBeenCalledTimes(1);
    expect(secondExecuteQuery).toHaveBeenCalledTimes(0);
  });

  it("does not re-run auto-query for the same query key", async () => {
    const executeQuery = vi.fn().mockResolvedValue({ hits: { total: 1 } });
    const onError = vi.fn();
    const setError = vi.fn();
    const setLoading = vi.fn();
    const setLoadingMessage = vi.fn();
    const setResult = vi.fn();

    const { rerender } = renderHook(
      ({ nextOnError }) => {
        const skipNextAutoQueryRef = useRef(false);

        useEsDataBrowserAutoQuery({
          activeConnectionId: "es-1",
          executeQuery,
          onError: nextOnError,
          page: 1,
          selectedIndex: "logs-2026",
          setError,
          setLoading,
          setLoadingMessage,
          setResult,
          size: 10,
          skipNextAutoQueryRef,
        });
      },
      {
        initialProps: { nextOnError: onError },
      }
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(executeQuery).toHaveBeenCalledTimes(1);

    rerender({ nextOnError: vi.fn() });

    await act(async () => {
      await Promise.resolve();
    });

    expect(executeQuery).toHaveBeenCalledTimes(1);
  });

  it("clears loading when the selected index is removed during an in-flight query", async () => {
    let resolveQuery: ((value: unknown) => void) | undefined;
    const executeQuery = vi.fn().mockImplementation(
      () => new Promise((resolve) => {
        resolveQuery = resolve;
      })
    );
    const onError = vi.fn();
    const setError = vi.fn();
    const setLoading = vi.fn();
    const setLoadingMessage = vi.fn();
    const setResult = vi.fn();

    const { result } = renderHook(() => {
      const [selectedIndex, setSelectedIndex] = useState<string | undefined>("logs-2026");
      const skipNextAutoQueryRef = useRef(false);

      useEsDataBrowserAutoQuery({
        activeConnectionId: "es-1",
        executeQuery,
        onError,
        page: 1,
        selectedIndex,
        setError,
        setLoading,
        setLoadingMessage,
        setResult,
        size: 10,
        skipNextAutoQueryRef,
      });

      return { setSelectedIndex };
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(setLoading).toHaveBeenCalledWith(true);

    act(() => {
      result.current.setSelectedIndex(undefined);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(setLoading).toHaveBeenCalledWith(false);
    expect(setLoadingMessage).toHaveBeenCalledWith("");

    resolveQuery?.({ hits: { total: 1 } });
  });
});
