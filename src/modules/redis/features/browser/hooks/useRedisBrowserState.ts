import { useCallback, useState } from "react";
import type { RedisBrowserState } from "../types";

const DEFAULT_BROWSER_STATE: RedisBrowserState = {
  databases: [],
  keyPattern: "",
  scannedKeys: [],
  nextCursor: "0",
  hasMoreKeys: false,
  selectedKey: null,
  selectedKeyDetail: null,
  error: "",
};

export function useRedisBrowserState() {
  const [databases, setDatabases] = useState(DEFAULT_BROWSER_STATE.databases);
  const [keyPattern, setKeyPattern] = useState(DEFAULT_BROWSER_STATE.keyPattern);
  const [scannedKeys, setScannedKeys] = useState(DEFAULT_BROWSER_STATE.scannedKeys);
  const [nextCursor, setNextCursor] = useState(DEFAULT_BROWSER_STATE.nextCursor);
  const [hasMoreKeys, setHasMoreKeys] = useState(DEFAULT_BROWSER_STATE.hasMoreKeys);
  const [selectedKey, setSelectedKey] = useState(DEFAULT_BROWSER_STATE.selectedKey);
  const [selectedKeyDetail, setSelectedKeyDetail] = useState(DEFAULT_BROWSER_STATE.selectedKeyDetail);
  const [error, setError] = useState(DEFAULT_BROWSER_STATE.error);

  const resetBrowserState = useCallback(() => {
    setDatabases(DEFAULT_BROWSER_STATE.databases);
    setKeyPattern(DEFAULT_BROWSER_STATE.keyPattern);
    setScannedKeys(DEFAULT_BROWSER_STATE.scannedKeys);
    setNextCursor(DEFAULT_BROWSER_STATE.nextCursor);
    setHasMoreKeys(DEFAULT_BROWSER_STATE.hasMoreKeys);
    setSelectedKey(DEFAULT_BROWSER_STATE.selectedKey);
    setSelectedKeyDetail(DEFAULT_BROWSER_STATE.selectedKeyDetail);
    setError(DEFAULT_BROWSER_STATE.error);
  }, []);

  return {
    databases,
    setDatabases,
    keyPattern,
    setKeyPattern,
    scannedKeys,
    setScannedKeys,
    nextCursor,
    setNextCursor,
    hasMoreKeys,
    setHasMoreKeys,
    selectedKey,
    setSelectedKey,
    selectedKeyDetail,
    setSelectedKeyDetail,
    error,
    setError,
    resetBrowserState,
  };
}
