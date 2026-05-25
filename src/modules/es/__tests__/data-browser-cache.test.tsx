import { act, renderHook } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import type { FieldFilterState } from "../../../components/FieldFilterButton";
import { useEsDataBrowserCache } from "../features/data-browser/hooks/useEsDataBrowserCache";
import { createDefaultEsCondition } from "../features/data-browser/hooks/useEsQueryConditions";
import type { ConditionItem, ViewMode } from "../features/data-browser/types";

function useCacheHarness(activeConnectionId?: string) {
  const defaultCondition = createDefaultEsCondition();
  const [conditions, setConditionsState] = useState<ConditionItem[]>([{ ...defaultCondition }]);
  const [fieldFilter, setFieldFilterState] = useState<FieldFilterState>({ enabled: false, fields: [] });
  const [fields, setFieldsState] = useState<string[]>([]);
  const [page, setPageState] = useState(1);
  const [result, setResultState] = useState<any>(null);
  const [selectedIndex, setSelectedIndexState] = useState<string | undefined>(undefined);
  const [size, setSizeState] = useState(10);
  const [viewMode, setViewModeState] = useState<ViewMode>("table");
  const skipNextAutoQueryRef = useRef(false);

  useEsDataBrowserCache({
    activeConnectionId,
    conditions,
    defaultCondition,
    fieldFilter,
    page,
    result,
    selectedIndex,
    setConditions: setConditionsState,
    setFieldFilter: setFieldFilterState,
    setFields: setFieldsState,
    setPage: setPageState,
    setResult: setResultState,
    setSelectedIndex: setSelectedIndexState,
    setSize: setSizeState,
    setViewMode: setViewModeState,
    size,
    skipNextAutoQueryRef,
    viewMode,
  });

  return {
    conditions,
    fieldFilter,
    fields,
    page,
    result,
    selectedIndex,
    size,
    skipNextAutoQueryRef,
    viewMode,
    setConditions: setConditionsState,
    setFieldFilter: setFieldFilterState,
    setPage: setPageState,
    setResult: setResultState,
    setSelectedIndex: setSelectedIndexState,
    setSize: setSizeState,
    setViewMode: setViewModeState,
  };
}

describe("useEsDataBrowserCache", () => {
  it("restores cached state when the same connection is mounted again", () => {
    const connectionId = "cache-restore-connection";
    const cachedConditions: ConditionItem[] = [
      { field: "level", operator: "term", value: "error", boolType: "must", enabled: true },
    ];

    const first = renderHook(() => useCacheHarness(connectionId));

    act(() => {
      first.result.current.setSelectedIndex("logs-2026");
      first.result.current.setResult({ hits: { total: 5 } });
      first.result.current.setPage(3);
      first.result.current.setSize(50);
      first.result.current.setConditions(cachedConditions);
      first.result.current.setFieldFilter({ enabled: true, fields: ["message", "level"] });
      first.result.current.setViewMode("json");
    });

    first.unmount();

    const second = renderHook(() => useCacheHarness(connectionId));

    expect(second.result.current.selectedIndex).toBe("logs-2026");
    expect(second.result.current.result).toEqual({ hits: { total: 5 } });
    expect(second.result.current.page).toBe(3);
    expect(second.result.current.size).toBe(50);
    expect(second.result.current.conditions).toEqual(cachedConditions);
    expect(second.result.current.fieldFilter).toEqual({ enabled: true, fields: ["message", "level"] });
    expect(second.result.current.viewMode).toBe("json");
    expect(second.result.current.skipNextAutoQueryRef.current).toBe(true);
  });

  it("resets state when there is no active connection", () => {
    const { result } = renderHook(() => {
      const [connectionId, setConnectionId] = useState<string | undefined>("cache-reset-connection");
      return {
        connectionId,
        setConnectionId,
        cache: useCacheHarness(connectionId),
      };
    });

    act(() => {
      result.current.cache.setSelectedIndex("logs-2026");
      result.current.cache.setResult({ hits: { total: 8 } });
      result.current.cache.setPage(4);
      result.current.cache.setSize(25);
      result.current.cache.setConditions([
        { field: "service", operator: "term", value: "billing", boolType: "must", enabled: true },
      ]);
      result.current.cache.setFieldFilter({ enabled: true, fields: ["service"] });
      result.current.cache.setViewMode("json");
    });

    act(() => {
      result.current.setConnectionId(undefined);
    });

    expect(result.current.cache.selectedIndex).toBeUndefined();
    expect(result.current.cache.result).toBeNull();
    expect(result.current.cache.page).toBe(1);
    expect(result.current.cache.size).toBe(10);
    expect(result.current.cache.conditions).toEqual([createDefaultEsCondition()]);
    expect(result.current.cache.fieldFilter).toEqual({ enabled: false, fields: [] });
    expect(result.current.cache.viewMode).toBe("table");
    expect(result.current.cache.fields).toEqual([]);
    expect(result.current.cache.skipNextAutoQueryRef.current).toBe(false);
  });
});