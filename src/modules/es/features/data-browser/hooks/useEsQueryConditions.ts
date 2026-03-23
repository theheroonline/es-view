import type { Dispatch, SetStateAction } from "react";
import { useCallback } from "react";
import type { BoolType, ConditionItem, ContextMenuState, SortDirection } from "../types";

export function createDefaultEsCondition(): ConditionItem {
  return { field: "", operator: "term", value: "", boolType: "must", enabled: true };
}

interface UseEsQueryConditionsParams {
  setConditions: Dispatch<SetStateAction<ConditionItem[]>>;
  setResult: Dispatch<SetStateAction<any>>;
  setSelectedIndex: Dispatch<SetStateAction<string | undefined>>;
  setShowQueryConditions: Dispatch<SetStateAction<boolean>>;
}

export function useEsQueryConditions({
  setConditions,
  setResult,
  setSelectedIndex,
  setShowQueryConditions,
}: UseEsQueryConditionsParams) {
  const handleIndexChange = useCallback((index: string) => {
    setSelectedIndex(index || undefined);
    setConditions([createDefaultEsCondition()]);
    setResult(null);
  }, [setConditions, setResult, setSelectedIndex]);

  const handleConditionChange = useCallback((idx: number, next: Partial<ConditionItem>) => {
    setConditions((prev) => prev.map((item, index) => (index === idx ? { ...item, ...next } : item)));
  }, [setConditions]);

  const addCondition = useCallback((idx?: number) => {
    if (idx === undefined) {
      setShowQueryConditions(true);
    }
    setConditions((prev) => {
      if (!prev.length) {
        return [createDefaultEsCondition()];
      }
      const next = [...prev];
      const insertIndex = idx !== undefined ? idx + 1 : next.length;
      next.splice(insertIndex, 0, createDefaultEsCondition());
      return next;
    });
  }, [setConditions, setShowQueryConditions]);

  const showConditions = useCallback(() => {
    setShowQueryConditions(true);
  }, [setShowQueryConditions]);

  const removeCondition = useCallback((idx: number) => {
    setConditions((prev) => {
      if (prev.length === 1) {
        return [createDefaultEsCondition()];
      }
      return prev.filter((_, index) => index !== idx);
    });
  }, [setConditions]);

  const toggleCondition = useCallback((idx: number) => {
    setConditions((prev) => prev.map((item, index) => (index === idx ? { ...item, enabled: !item.enabled } : item)));
  }, [setConditions]);

  const addConditionFromContext = useCallback((contextMenu: ContextMenuState, boolType: BoolType) => {
    if (!contextMenu.field || contextMenu.value === undefined) {
      return;
    }
    const field = contextMenu.field;
    const value = typeof contextMenu.value === "object" ? JSON.stringify(contextMenu.value) : String(contextMenu.value);
    setShowQueryConditions(true);
    setConditions((prev) => [...prev, {
      field,
      operator: "term",
      value,
      boolType,
      enabled: true,
    }]);
  }, [setConditions, setShowQueryConditions]);

  const addSortFromContext = useCallback((contextMenu: ContextMenuState, direction: SortDirection) => {
    if (!contextMenu.field) {
      return;
    }
    const field = contextMenu.field;
    setShowQueryConditions(true);
    setConditions((prev) => [...prev, {
      field,
      operator: "term",
      value: "",
      boolType: "sort",
      enabled: true,
      sortDirection: direction,
    }]);
  }, [setConditions, setShowQueryConditions]);

  return {
    addCondition,
    addConditionFromContext,
    addSortFromContext,
    handleConditionChange,
    handleIndexChange,
    removeCondition,
    showConditions,
    toggleCondition,
  };
}