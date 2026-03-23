import type { MutableRefObject } from "react";
import { useEffect, useRef } from "react";

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
  const executeQueryRef = useRef(executeQuery);
  const onErrorRef = useRef(onError);
  const lastAutoQueryKeyRef = useRef<string | null>(null);

  useEffect(() => {
    executeQueryRef.current = executeQuery;
  }, [executeQuery]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!selectedIndex || !activeConnectionId || page <= 0 || size <= 0) {
      lastAutoQueryKeyRef.current = null;
      return;
    }

    if (skipNextAutoQueryRef.current) {
      skipNextAutoQueryRef.current = false;
      return;
    }

    const autoQueryKey = `${activeConnectionId}::${selectedIndex}::${page}::${size}`;
    if (lastAutoQueryKeyRef.current === autoQueryKey) {
      return;
    }
    lastAutoQueryKeyRef.current = autoQueryKey;

    let ignore = false;

    void (async () => {
      setError("");
      setLoading(true);
      setLoadingMessage("");

      try {
        const response = await executeQueryRef.current();
        if (!ignore) {
          setResult(response);
        }
      } catch (error) {
        onErrorRef.current(error);
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
      setLoading(false);
      setLoadingMessage("");
    };
  }, [activeConnectionId, page, selectedIndex, setError, setLoading, setLoadingMessage, setResult, size, skipNextAutoQueryRef]);
}