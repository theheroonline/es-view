import type { TFunction } from "i18next";
import { useCallback } from "react";
import { logError } from "../../../../../lib/errorLog";
import { searchDocuments } from "../services/esSearchService";
import type { ConditionItem } from "../types";

interface UseEsSearchExecutionParams {
  activeConnection: any;
  conditions: ConditionItem[];
  formatDateTime: (value: any) => string;
  page: number;
  selectedIndex?: string;
  setError: (value: string) => void;
  setLoading: (value: boolean) => void;
  setLoadingMessage: (value: string) => void;
  setResult: (value: any) => void;
  size: number;
  t: TFunction;
}

interface SearchAfterParams {
  activeConnection: any;
  selectedIndex: string;
  from: number;
  size: number;
  query: Record<string, unknown>;
  sortParams: unknown[];
  batchSize?: number;
  setLoadingMessage?: (msg: string) => void;
  page?: number;
  t?: TFunction;
}

/**
 * 使用 search_after 进行深度分页查询。当 from > 10000 时 ES 不支持传统 from+size 分页。
 * 通过批量跳过文档（每批 1000 条）到达目标位置，最后获取实际数据。
 */
async function executeSearchAfter({
  activeConnection,
  selectedIndex,
  from,
  size,
  query,
  sortParams,
  batchSize = 1000,
  setLoadingMessage,
  page,
  t,
}: SearchAfterParams) {
  let currentPosition = 0;
  let searchAfter: unknown[] | undefined;

  while (currentPosition + batchSize < from) {
    const skipBody: Record<string, unknown> = {
      size: batchSize,
      query,
      sort: sortParams,
      track_total_hits: true,
      _source: false,
    };
    if (searchAfter) {
      skipBody.search_after = searchAfter;
    }

    if (setLoadingMessage) {
      setLoadingMessage(t?.("dataBrowser.skippingData", { count: currentPosition + batchSize }) ?? "");
    }
    const skipResult = await searchDocuments(activeConnection, selectedIndex, skipBody);
    const hits = skipResult?.hits?.hits ?? [];

    if (hits.length === 0) break;

    searchAfter = hits[hits.length - 1]?.sort;
    currentPosition += hits.length;

    if (hits.length < batchSize) break;
  }

  const remaining = from - currentPosition;
  if (remaining > 0 && searchAfter) {
    const skipBody: Record<string, unknown> = {
      size: remaining,
      query,
      sort: sortParams,
      track_total_hits: true,
      _source: false,
    };
    skipBody.search_after = searchAfter;

    if (setLoadingMessage) {
      setLoadingMessage(t?.("dataBrowser.locatingData", { position: from }) ?? "");
    }
    const skipResult = await searchDocuments(activeConnection, selectedIndex, skipBody);
    const hits = skipResult?.hits?.hits ?? [];

    if (hits.length > 0) {
      searchAfter = hits[hits.length - 1]?.sort;
    }
  }

  if (setLoadingMessage && page) {
    setLoadingMessage(t?.("dataBrowser.fetchingPage", { page }) ?? "");
  }
  const finalBody: Record<string, unknown> = {
    size,
    query,
    sort: sortParams,
    track_total_hits: true,
  };
  if (searchAfter) {
    finalBody.search_after = searchAfter;
  }

  return await searchDocuments(activeConnection, selectedIndex, finalBody);
}

export function useEsSearchExecution({
  activeConnection,
  conditions,
  formatDateTime,
  page,
  selectedIndex,
  setError,
  setLoading,
  setLoadingMessage,
  setResult,
  size,
  t,
}: UseEsSearchExecutionParams) {
  const buildSearchContext = useCallback((rangeErrorSource: string) => {
    const activeConditions = conditions.filter((item) =>
      item.enabled && item.boolType !== "sort" && item.field && (item.value || (item.operator === "time_range" && item.rangeValue && item.rangeValue[0] && item.rangeValue[1]))
    );
    const activeSorts = conditions.filter((item) => item.enabled && item.boolType === "sort" && item.field);

    let query: any = { match_all: {} };
    const boolBuckets: Record<string, any[]> = { must: [], should: [], must_not: [] };
    for (const item of activeConditions) {
      if (item.operator === "time_range" && item.rangeValue && item.rangeValue[0] && item.rangeValue[1]) {
        const startStr = formatDateTime(item.rangeValue[0]);
        const endStr = formatDateTime(item.rangeValue[1]);
        boolBuckets[item.boolType]?.push({ range: { [item.field]: { gte: startStr, lte: endStr } } });
        continue;
      }

      let parsed: unknown;
      if (item.operator === "range") {
        try {
          parsed = JSON.parse(item.value);
        } catch (error) {
          logError(error, {
            source: rangeErrorSource,
            message: `Failed to parse range query JSON for field ${item.field}`,
          });
          throw new Error(t("dataBrowser.rangeError"));
        }
      }

      if (item.operator === "term") {
        boolBuckets[item.boolType]?.push({ term: { [item.field]: item.value } });
      } else if (item.operator === "match") {
        boolBuckets[item.boolType]?.push({ match: { [item.field]: item.value } });
      } else if (item.operator === "range" && parsed != null) {
        boolBuckets[item.boolType]?.push({ range: { [item.field]: parsed } });
      } else if (item.operator === "exists") {
        boolBuckets[item.boolType]?.push({ exists: { field: item.field } });
      } else if (item.operator === "missing") {
        boolBuckets[item.boolType]?.push({ bool: { must_not: { exists: { field: item.field } } } });
      } else if (item.operator === "terms") {
        const terms = item.value.split(",").map((v) => {
          const trimmed = v.trim();
          if (!trimmed) return null;
          const num = Number(trimmed);
          if (!isNaN(num) && String(num) === trimmed) return num;
          if (trimmed === "true") return true;
          if (trimmed === "false") return false;
          return trimmed;
        }).filter((v): v is string | number | boolean => v !== null);
        if (terms.length > 0) {
          boolBuckets[item.boolType]?.push({ terms: { [item.field]: terms } });
        }
      } else if (item.operator === "wildcard") {
        boolBuckets[item.boolType]?.push({ wildcard: { [item.field]: { value: item.value } } });
      }
    }

    const boolQuery: Record<string, any[]> = {};
    for (const key of Object.keys(boolBuckets)) {
      if (boolBuckets[key].length > 0) {
        boolQuery[key] = boolBuckets[key];
      }
    }

    if (Object.keys(boolQuery).length > 0) {
      query = { bool: boolQuery };
    }

    const from = (page - 1) * size;
    let sortParams = activeSorts.map((item) => ({ [item.field]: { order: item.sortDirection || "asc" } }));

    // search_after 要求至少一个排序字段以确保结果唯一性
    if (sortParams.length === 0) {
      sortParams = [{ _doc: { order: "asc" } }];
    }

    return {
      from,
      query,
      sortParams,
    };
  }, [conditions, formatDateTime, page, size, t]);

  const executeQuery = useCallback(async () => {
    if (!activeConnection) {
      throw new Error(t("dataBrowser.pleaseSetConnection"));
    }
    if (!selectedIndex) {
      throw new Error(t("dataBrowser.pleaseSelectIndex"));
    }

    const { from, query, sortParams } = buildSearchContext("esDataBrowser.parseRange");

    if (from + size <= 10000) {
      const body: Record<string, unknown> = {
        from,
        size,
        query,
        sort: sortParams,
        track_total_hits: true,
      };
      return await searchDocuments(activeConnection, selectedIndex, body);
    }

    return executeSearchAfter({
      activeConnection,
      selectedIndex,
      from,
      size,
      query,
      sortParams,
    });
  }, [activeConnection, buildSearchContext, selectedIndex, size, t]);

  const execute = useCallback(async () => {
    setError("");
    setResult(null);
    setLoading(true);
    setLoadingMessage("");

    if (!activeConnection) {
      setError(t("dataBrowser.pleaseSetConnection"));
      setLoading(false);
      return;
    }
    if (!selectedIndex) {
      setError(t("dataBrowser.pleaseSelectIndex"));
      setLoading(false);
      return;
    }

    try {
      const { from, query, sortParams } = buildSearchContext("esDataBrowser.parseRangeExecute");

      if (from + size <= 10000) {
        const body: Record<string, unknown> = {
          from,
          size,
          query,
          sort: sortParams,
          track_total_hits: true,
        };
        const data = await searchDocuments(activeConnection, selectedIndex, body);
        setResult(data);
        return;
      }

      setLoadingMessage(t("dataBrowser.queryingPage", { page }));

      const data = await executeSearchAfter({
        activeConnection,
        selectedIndex,
        from,
        size,
        query,
        sortParams,
        setLoadingMessage,
        page,
        t,
      });
      setResult(data);
    } catch (error) {
      logError(error, {
        source: "esDataBrowser.execute",
        message: "Elasticsearch data query failed",
      });
      setError(t("dataBrowser.queryFailed") + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }, [activeConnection, buildSearchContext, page, selectedIndex, setError, setLoading, setLoadingMessage, setResult, size, t]);

  return {
    execute,
    executeQuery,
  };
}
