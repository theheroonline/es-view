import type { MutableRefObject } from "react";
import { useEffect } from "react";

interface UseEsDataBrowserAutoQueryParams {
  activeConnectionId?: string;
  executeQuery: () => Promise<any>;
  onError: (error: unknown) => void;
  page: number;
  selectedIndex?: string;
  setError: (value: string) => void;
  setLoading: (value: boolean) => void;
  setLoadingMessage: (value: string) => void;
  setResult: (value: any) => void;
  size: number;
  skipNextAutoQueryRef: MutableRefObject<boolean>;
}

export function useEsDataBrowserAutoQuery({
  activeConnectionId,
  executeQuery,
  onError,
  page,
  selectedIndex,
  setError,
  setLoading,
  setLoadingMessage,
  setResult,
  size,
  skipNextAutoQueryRef,
}: UseEsDataBrowserAutoQueryParams) {
  useEffect(() => {
    if (!selectedIndex || !activeConnectionId || page <= 0 || size <= 0) {
      return;
    }

    if (skipNextAutoQueryRef.current) {
      skipNextAutoQueryRef.current = false;
      return;
    }

    let ignore = false;

    void (async () => {
      setError("");
      setLoading(true);
      setLoadingMessage("");

      try {
        const response = await executeQuery();
        if (!ignore) {
          setResult(response);
        }
      } catch (error) {
        onError(error);
        if (!ignore) {
          setError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!ignore) {
          setLoading(false);
          setLoadingMessage("");
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [activeConnectionId, executeQuery, onError, page, selectedIndex, setError, setLoading, setLoadingMessage, setResult, size, skipNextAutoQueryRef]);
}