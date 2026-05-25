import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { createDefaultEsCondition, useEsQueryConditions } from "../features/data-browser/hooks/useEsQueryConditions";
import type { ConditionItem, ContextMenuState } from "../features/data-browser/types";

describe("useEsQueryConditions", () => {
  it("resets selected index, conditions and result when the index changes", () => {
    const { result } = renderHook(() => {
      const [conditions, setConditions] = useState<ConditionItem[]>([
        { field: "level", operator: "term", value: "error", boolType: "must", enabled: true },
      ]);
      const [selectedIndex, setSelectedIndex] = useState<string | undefined>("logs-old");
      const [showQueryConditions, setShowQueryConditions] = useState(false);
      const [searchResult, setResult] = useState<any>({ hits: { total: 10 } });

      return {
        conditions,
        selectedIndex,
        showQueryConditions,
        searchResult,
        actions: useEsQueryConditions({
          setConditions,
          setResult,
          setSelectedIndex,
          setShowQueryConditions,
        }),
      };
    });

    act(() => {
      result.current.actions.handleIndexChange("logs-next");
    });

    expect(result.current.selectedIndex).toBe("logs-next");
    expect(result.current.conditions).toEqual([createDefaultEsCondition()]);
    expect(result.current.searchResult).toBeNull();
  });

  it("inserts a new condition after the given row", () => {
    const { result } = renderHook(() => {
      const [conditions, setConditions] = useState<ConditionItem[]>([
        { field: "service", operator: "term", value: "api", boolType: "must", enabled: true },
      ]);
      const [, setSelectedIndex] = useState<string | undefined>(undefined);
      const [showQueryConditions, setShowQueryConditions] = useState(false);
      const [, setResult] = useState<any>(null);

      return {
        conditions,
        showQueryConditions,
        actions: useEsQueryConditions({
          setConditions,
          setResult,
          setSelectedIndex,
          setShowQueryConditions,
        }),
      };
    });

    act(() => {
      result.current.actions.addCondition(0);
    });

    expect(result.current.conditions).toHaveLength(2);
    expect(result.current.conditions[1]).toEqual(createDefaultEsCondition());
  });

  it("opens the query conditions panel when requested explicitly", () => {
    const { result } = renderHook(() => {
      const [, setConditions] = useState<ConditionItem[]>([createDefaultEsCondition()]);
      const [, setSelectedIndex] = useState<string | undefined>(undefined);
      const [showQueryConditions, setShowQueryConditions] = useState(false);
      const [, setResult] = useState<any>(null);

      return {
        showQueryConditions,
        actions: useEsQueryConditions({
          setConditions,
          setResult,
          setSelectedIndex,
          setShowQueryConditions,
        }),
      };
    });

    act(() => {
      result.current.actions.showConditions();
    });

    expect(result.current.showQueryConditions).toBe(true);
  });

  it("appends a condition from context using stringified object values", () => {
    const contextMenu: ContextMenuState = {
      visible: true,
      x: 1,
      y: 2,
      row: null,
      field: "payload",
      value: { source: "gateway" },
    };

    const { result } = renderHook(() => {
      const [conditions, setConditions] = useState<ConditionItem[]>([createDefaultEsCondition()]);
      const [, setSelectedIndex] = useState<string | undefined>(undefined);
      const [showQueryConditions, setShowQueryConditions] = useState(false);
      const [, setResult] = useState<any>(null);

      return {
        conditions,
        showQueryConditions,
        actions: useEsQueryConditions({
          setConditions,
          setResult,
          setSelectedIndex,
          setShowQueryConditions,
        }),
      };
    });

    act(() => {
      result.current.actions.addConditionFromContext(contextMenu, "should");
    });

    expect(result.current.showQueryConditions).toBe(true);
    expect(result.current.conditions.at(-1)).toEqual({
      field: "payload",
      operator: "term",
      value: JSON.stringify({ source: "gateway" }),
      boolType: "should",
      enabled: true,
    });
  });

  it("replaces the last remaining condition with the default row when removed", () => {
    const { result } = renderHook(() => {
      const [conditions, setConditions] = useState<ConditionItem[]>([
        { field: "status", operator: "term", value: "500", boolType: "must", enabled: true },
      ]);
      const [, setSelectedIndex] = useState<string | undefined>(undefined);
      const [, setShowQueryConditions] = useState(true);
      const [, setResult] = useState<any>(null);

      return {
        conditions,
        actions: useEsQueryConditions({
          setConditions,
          setResult,
          setSelectedIndex,
          setShowQueryConditions,
        }),
      };
    });

    act(() => {
      result.current.actions.removeCondition(0);
    });

    expect(result.current.conditions).toEqual([createDefaultEsCondition()]);
  });
});