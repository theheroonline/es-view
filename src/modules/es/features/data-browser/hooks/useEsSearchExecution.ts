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
      } else if (item.operator === "range" && parsed) {
        boolBuckets[item.boolType]?.push({ range: { [item.field]: parsed } });
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
    const sortParams = activeSorts.map((item) => ({ [item.field]: { order: item.sortDirection || "asc" } }));

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
    const adjustedFrom = Math.min(from, 10000 - size);
    const body: Record<string, unknown> = {
      from: adjustedFrom,
      size,
      query,
      sort: sortParams,
      track_total_hits: true,
    };

    return await searchDocuments(activeConnection, selectedIndex, body);
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

      const batchSize = 1000;
      const targetFrom = from;
      let currentPosition = 0;
      let searchAfter: any[] | undefined;

      while (currentPosition + batchSize < targetFrom) {
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

        setLoadingMessage(t("dataBrowser.skippingData", { count: currentPosition + batchSize }));
        const skipResult = await searchDocuments(activeConnection, selectedIndex, skipBody);
        const hits = skipResult?.hits?.hits ?? [];

        if (hits.length === 0) {
          break;
        }

        searchAfter = hits[hits.length - 1]?.sort;
        currentPosition += hits.length;

        if (hits.length < batchSize) {
          break;
        }
      }

      const remaining = targetFrom - currentPosition;
      if (remaining > 0 && searchAfter) {
        const skipBody: Record<string, unknown> = {
          size: remaining,
          query,
          sort: sortParams,
          track_total_hits: true,
          _source: false,
        };
        skipBody.search_after = searchAfter;

        setLoadingMessage(t("dataBrowser.locatingData", { position: targetFrom }));
        const skipResult = await searchDocuments(activeConnection, selectedIndex, skipBody);
        const hits = skipResult?.hits?.hits ?? [];

        if (hits.length > 0) {
          searchAfter = hits[hits.length - 1]?.sort;
        }
      }

      setLoadingMessage(t("dataBrowser.fetchingPage", { page }));
      const finalBody: Record<string, unknown> = {
        size,
        query,
        sort: sortParams,
        track_total_hits: true,
      };
      if (searchAfter) {
        finalBody.search_after = searchAfter;
      }

      const data = await searchDocuments(activeConnection, selectedIndex, finalBody);
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