import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { listIndices } from "../lib/esView";
import { loadState, saveState } from "../lib/storage";
import type { ConnectionProfile, EsConnection, LocalState } from "../lib/types";

interface AppContextValue {
  state: LocalState;
  saveConnection: (profile: ConnectionProfile, secret: { username?: string; password?: string; apiKey?: string }) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
  setActiveConnection: (id: string) => Promise<void>;
  addHistory: (title: string, sql: string) => Promise<void>;
  getActiveConnection: () => EsConnection | null;
  getConnectionById: (id: string) => EsConnection | null;
  indices: string[];
  refreshIndices: (connection?: EsConnection | null) => Promise<void>;
  selectedIndex: string | undefined;
  setSelectedIndex: (index: string | undefined) => Promise<void>;
}

const defaultState: LocalState = {
  profiles: [],
  secrets: {},
  history: []
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LocalState>(defaultState);
  const [indices, setIndices] = useState<string[]>([]);

  useEffect(() => {
    loadState().then((loaded) => setState(loaded));
  }, []);

  const persist = useCallback(async (nextState: LocalState) => {
    await saveState(nextState);
    setState(nextState);
  }, []);

  const saveConnection = useCallback(async (profile: ConnectionProfile, secret: { username?: string; password?: string; apiKey?: string }) => {
    const profiles = [...state.profiles];
    const index = profiles.findIndex((item) => item.id === profile.id);
    if (index >= 0) {
      profiles[index] = profile;
    } else {
      profiles.push(profile);
    }
    const nextState: LocalState = {
      ...state,
      profiles,
      secrets: {
        ...state.secrets,
        [profile.id]: secret
      },
      lastConnectionId: profile.id
    };
    await persist(nextState);
  }, [state, persist]);

  const deleteConnection = useCallback(async (id: string) => {
    const profiles = state.profiles.filter((item) => item.id !== id);
    const secrets = { ...state.secrets };
    delete secrets[id];
    const nextState: LocalState = {
      ...state,
      profiles,
      secrets,
      lastConnectionId: state.lastConnectionId === id ? profiles[0]?.id : state.lastConnectionId
    };
    await persist(nextState);
  }, [state, persist]);

  const setActiveConnection = useCallback(async (id: string) => {
    await persist({ ...state, lastConnectionId: id });
  }, [state, persist]);

  const addHistory = useCallback(async (title: string, sql: string) => {
    const trimmedSql = sql.trim();
    if (!trimmedSql) return; // 不记录空 SQL

    // 规范化 SQL：移除末尾分号、压缩空白并转小写，用于去重比较
    const normalize = (s: string) => s.replace(/\s*;+\s*$/g, "").replace(/\s+/g, " ").trim().toLowerCase();
    const normalizedNew = normalize(trimmedSql);

    const item = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      sql: trimmedSql,
      createdAt: new Date().toISOString()
    };

    const HISTORY_LIMIT = 10;
    // 去重：移除已有相同（规范化后）SQL 的历史项（保留最近一次）
    const filtered = state.history.filter((h) => normalize(h.sql || '') !== normalizedNew);
    const nextState: LocalState = {
      ...state,
      history: [item, ...filtered].slice(0, HISTORY_LIMIT)
    };
    await persist(nextState);
  }, [state, persist]);

  const getActiveConnection = useCallback((): EsConnection | null => {
    const id = state.lastConnectionId;
    if (!id) return null;
    const profile = state.profiles.find((item) => item.id === id);
    if (!profile) return null;
    const secret = state.secrets[id] ?? {};
    return {
      ...profile,
      username: secret.username,
      password: secret.password,
      apiKey: secret.apiKey
    };
  }, [state]);

  const getConnectionById = useCallback((id: string): EsConnection | null => {
    const profile = state.profiles.find((item) => item.id === id);
    if (!profile) return null;
    const secret = state.secrets[id] ?? {};
    return {
      ...profile,
      username: secret.username,
      password: secret.password,
      apiKey: secret.apiKey
    };
  }, [state]);

  const setSelectedIndex = useCallback(async (index: string | undefined) => {
    await persist({ ...state, selectedIndex: index });
  }, [state, persist]);

  const refreshIndices = useCallback(async (connection?: EsConnection | null) => {
    const target = connection ?? getActiveConnection();
    if (!target) {
      setIndices([]);
      return;
    }
    try {
      const data = await listIndices(target);
      const next = data.map((item) => item.index);
      setIndices(next);
      setState((prev) => {
        if (prev.selectedIndex && !next.includes(prev.selectedIndex)) {
          return { ...prev, selectedIndex: undefined };
        }
        return prev;
      });
    } catch {
      setIndices([]);
    }
  }, [getActiveConnection]);

  useEffect(() => {
    const active = getActiveConnection();
    refreshIndices(active).catch(() => setIndices([]));
  }, [getActiveConnection, refreshIndices]);

  const value = useMemo(() => ({
    state,
    saveConnection,
    deleteConnection,
    setActiveConnection,
    addHistory,
    getActiveConnection,
    getConnectionById,
    indices,
    refreshIndices,
    selectedIndex: state.selectedIndex,
    setSelectedIndex
  }), [state, saveConnection, deleteConnection, setActiveConnection, addHistory, getActiveConnection, getConnectionById, indices, refreshIndices, setSelectedIndex]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("AppContext 未初始化");
  }
  return ctx;
}
