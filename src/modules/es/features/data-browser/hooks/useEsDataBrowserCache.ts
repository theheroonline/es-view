import type { MutableRefObject } from "react";
import { useEffect } from "react";
import type { FieldFilterState } from "../components/FieldFilterButton";
import type { ConditionItem, DataBrowserCacheState, ViewMode } from "../types";

const dataBrowserCacheByConnection = new Map<string, DataBrowserCacheState>();
const defaultFieldFilterState: FieldFilterState = { enabled: false, fields: [] };

interface UseEsDataBrowserCacheParams {
  activeConnectionId?: string;
  conditions: ConditionItem[];
  defaultCondition: ConditionItem;
  fieldFilter: FieldFilterState;
  page: number;
  result: any;
  selectedIndex?: string;
  setConditions: (value: ConditionItem[]) => void;
  setFieldFilter: (value: FieldFilterState) => void;
  setFields: (value: string[]) => void;
  setPage: (value: number) => void;
  setResult: (value: any) => void;
  setSelectedIndex: (value: string | undefined) => void;
  setSize: (value: number) => void;
  setViewMode: (value: ViewMode) => void;
  size: number;
  skipNextAutoQueryRef: MutableRefObject<boolean>;
  viewMode: ViewMode;
}

export function useEsDataBrowserCache({
  activeConnectionId,
  conditions,
  defaultCondition,
  fieldFilter,
  page,
  result,
  selectedIndex,
  setConditions,
  setFieldFilter,
  setFields,
  setPage,
  setResult,
  setSelectedIndex,
  setSize,
  setViewMode,
  size,
  skipNextAutoQueryRef,
  viewMode,
}: UseEsDataBrowserCacheParams) {
  useEffect(() => {
    const resetState = () => {
      skipNextAutoQueryRef.current = false;
      setSelectedIndex(undefined);
      setConditions([{ ...defaultCondition }]);
      setResult(null);
      setPage(1);
      setSize(10);
      setFields([]);
      setFieldFilter(defaultFieldFilterState);
      setViewMode("table");
    };

    if (!activeConnectionId) {
      resetState();
      return;
    }

    const cached = dataBrowserCacheByConnection.get(activeConnectionId);
    if (!cached) {
      resetState();
      return;
    }

    skipNextAutoQueryRef.current = Boolean(cached.selectedIndex && cached.result);
    setSelectedIndex(cached.selectedIndex);
    setResult(cached.result);
    setPage(cached.page);
    setSize(cached.size);
    setConditions(cached.conditions.length > 0 ? cached.conditions : [{ ...defaultCondition }]);
    setFieldFilter(cached.fieldFilter);
    setViewMode(cached.viewMode);
  }, [activeConnectionId]);

  useEffect(() => {
    if (!activeConnectionId) {
      return;
    }

    dataBrowserCacheByConnection.set(activeConnectionId, {
      selectedIndex,
      result,
      page,
      size,
      conditions,
      viewMode,
      fieldFilter,
    });
  }, [activeConnectionId, conditions, fieldFilter, page, result, selectedIndex, size, viewMode]);
}