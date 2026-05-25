import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { normalizeConnectionProfile } from "../lib/connection/profile";
import type { EngineKey } from "../lib/connection/types";
import { logError } from "../lib/errorLog";
import { loadState, saveState } from "../lib/storage";
import type { ConnectionProfile, LocalState, SecretConfig } from "../lib/types";

const defaultState: LocalState = {
  profiles: [],
  secrets: {}
};

interface SharedConnectionStateValue {
  profiles: ConnectionProfile[];
  getSecretById: (id: string) => SecretConfig;
  activeConnectionId?: string;
  activeEngine?: EngineKey;
  /** @deprecated use activeConnectionIdsByEngine + focusedConnectionIdByEngine */
  activeConnectionIdByEngine: Partial<Record<EngineKey, string>>;
  /** All currently-active (backend-connected) connection IDs per engine */
  activeConnectionIdsByEngine: Partial<Record<EngineKey, string[]>>;
  /** Which connection has UI focus per engine */
  focusedConnectionIdByEngine: Partial<Record<EngineKey, string>>;
  /** Ref for real-time focused connection ID (avoids stale closures in setters) */
  focusedConnectionIdRef: React.MutableRefObject<Record<EngineKey, string | undefined>>;
  getActiveConnectionIdByEngine: (engine: EngineKey) => string | undefined;
  getFocusedConnectionIdByEngine: (engine: EngineKey) => string | undefined;
  saveConnection: (profile: ConnectionProfile, secret: SecretConfig) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
  /** @deprecated use activateConnection */
  setActiveConnection: (id: string, engine: EngineKey) => Promise<void>;
  activateConnection: (id: string, engine: EngineKey, focus?: boolean) => Promise<void>;
  focusConnection: (id: string, engine: EngineKey) => void;
  disconnectActiveConnection: (connectionId?: string, engine?: EngineKey) => Promise<void>;
  deactivateConnection: (id: string, engine: EngineKey) => void;
  getProfileById: (id: string) => ConnectionProfile | null;
  lastConnectionId?: string;
}

const SharedConnectionStateContext = createContext<SharedConnectionStateValue | null>(null);

export function SharedConnectionStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LocalState>(defaultState);
  const [activeConnectionIdsByEngine, setActiveConnectionIdsByEngine] = useState<Partial<Record<EngineKey, string[]>>>({});
  const [focusedConnectionIdByEngine, setFocusedConnectionIdByEngine] = useState<Partial<Record<EngineKey, string>>>({});
  const [activeEngine, setActiveEngine] = useState<EngineKey | undefined>(undefined);

  // Ref that tracks the focused connection ID per engine in real time.
  // Used by Context setters to avoid stale closure values.
  const focusedConnectionIdRef = useRef<Record<EngineKey, string | undefined>>({
    elasticsearch: undefined,
    mysql: undefined,
    redis: undefined,
  });

  // Keep a ref to current state for async operations
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Load state on mount
  useEffect(() => {
    loadState()
      .then((loaded) => {
        const normalizedProfiles = (loaded.profiles ?? [])
          .map((item) => normalizeConnectionProfile(item));
        const lastConnectionId = normalizedProfiles.some((item) => item.id === loaded.lastConnectionId)
          ? loaded.lastConnectionId
          : normalizedProfiles[0]?.id;

        setState({
          ...loaded,
          profiles: normalizedProfiles,
          lastConnectionId
        });
      })
      .catch((error) => {
        logError(error, {
          source: "sharedConnectionState.loadState",
          message: "Failed to load local application state"
        });
        setState(defaultState);
      });
  }, []);

  const getActiveConnectionIdByEngine = useCallback(
    (engine: EngineKey) => focusedConnectionIdByEngine[engine],
    [focusedConnectionIdByEngine]
  );

  const getFocusedConnectionIdByEngine = useCallback(
    (engine: EngineKey) => focusedConnectionIdByEngine[engine],
    [focusedConnectionIdByEngine]
  );

  const activateConnection = useCallback(async (id: string, engine: EngineKey, focus = true) => {
    setActiveConnectionIdsByEngine((prev) => {
      const current = prev[engine] ?? [];
      if (current.includes(id)) {
        return prev; // already active, just handle focus below
      }
      return {
        ...prev,
        [engine]: [...current, id],
      };
    });

    if (focus) {
      focusedConnectionIdRef.current[engine] = id;
      setActiveEngine(engine);
      setFocusedConnectionIdByEngine((prev) => ({ ...prev, [engine]: id }));
    }

    const currentState = stateRef.current;
    await saveState({ ...currentState, lastConnectionId: id });
  }, []);

  const focusConnection = useCallback((id: string, engine: EngineKey) => {
    focusedConnectionIdRef.current[engine] = id;
    setActiveEngine(engine);
    setFocusedConnectionIdByEngine((prev) => ({ ...prev, [engine]: id }));
  }, []);

  const deactivateConnection = useCallback((id: string, engine: EngineKey) => {
    setActiveConnectionIdsByEngine((prev) => {
      const current = prev[engine] ?? [];
      const remaining = current.filter((c) => c !== id);
      const updated = { ...prev, [engine]: remaining.length > 0 ? remaining : undefined };

      if (focusedConnectionIdByEngine[engine] === id) {
        const newFocus = remaining.length > 0 ? remaining[remaining.length - 1] : undefined;
        focusedConnectionIdRef.current[engine] = newFocus;
        setFocusedConnectionIdByEngine((fp) => ({ ...fp, [engine]: newFocus }));
        if (!newFocus && activeEngine === engine) {
          setActiveEngine(undefined);
        }
      }

      return updated;
    });
  }, [activeEngine, focusedConnectionIdByEngine]);

  // Backward-compatible shim
  const setActiveConnection = useCallback(async (id: string, engine: EngineKey) => {
    await activateConnection(id, engine, true);
  }, [activateConnection]);

  // Backward-compatible shim: maps engine → focused connection ID
  const activeConnectionIdByEngine = useMemo(() => {
    const result: Partial<Record<EngineKey, string>> = {};
    (Object.keys(focusedConnectionIdByEngine) as EngineKey[]).forEach((eng) => {
      result[eng] = focusedConnectionIdByEngine[eng];
    });
    return result;
  }, [focusedConnectionIdByEngine]);

  const disconnectActiveConnection = useCallback(async (connectionId?: string, engine?: EngineKey) => {
    const targetEngine = engine ?? activeEngine;
    const targetId = connectionId ?? (targetEngine ? focusedConnectionIdByEngine[targetEngine] : undefined);
    if (!targetId || !targetEngine) {
      return;
    }

    deactivateConnection(targetId, targetEngine);
  }, [activeEngine, deactivateConnection, focusedConnectionIdByEngine]);

  const deleteConnection = useCallback(async (id: string) => {
    const currentState = stateRef.current;
    const profiles = currentState.profiles.filter((item) => item.id !== id);
    const secrets = { ...currentState.secrets };
    delete secrets[id];

    setActiveConnectionIdsByEngine((prev) => {
      const next = { ...prev };
      (Object.keys(next) as EngineKey[]).forEach((engine) => {
        if (next[engine]?.includes(id)) {
          next[engine] = next[engine]!.filter((c) => c !== id);
          if (next[engine]!.length === 0) delete next[engine];
        }
      });
      return next;
    });

    setFocusedConnectionIdByEngine((prev) => {
      const next = { ...prev };
      (Object.keys(next) as EngineKey[]).forEach((engine) => {
        if (next[engine] === id) {
          const remaining = activeConnectionIdsByEngine[engine]?.filter((c) => c !== id);
          next[engine] = remaining?.[remaining.length - 1];
          if (!next[engine]) delete next[engine];
        }
      });
      return next;
    });

    await saveState({
      ...currentState,
      profiles,
      secrets,
      lastConnectionId: currentState.lastConnectionId === id ? profiles[0]?.id : currentState.lastConnectionId
    });
    setState({
      ...currentState,
      profiles,
      secrets,
      lastConnectionId: currentState.lastConnectionId === id ? profiles[0]?.id : currentState.lastConnectionId
    });
  }, [activeConnectionIdsByEngine]);

  const saveConnection = useCallback(async (profile: ConnectionProfile, secret: SecretConfig) => {
    const currentState = stateRef.current;
    const profiles = [...currentState.profiles];
    const index = profiles.findIndex((item) => item.id === profile.id);
    const normalizedProfile = normalizeConnectionProfile(profile);
    if (index >= 0) {
      profiles[index] = normalizedProfile;
    } else {
      profiles.push(normalizedProfile);
    }
    const nextState: LocalState = {
      ...currentState,
      profiles,
      secrets: {
        ...currentState.secrets,
        [profile.id]: secret
      },
      lastConnectionId: normalizedProfile.id
    };
    await saveState(nextState);
    setState(nextState);
  }, []);

  const getProfileById = useCallback(
    (id: string): ConnectionProfile | null => state.profiles.find((item) => item.id === id) ?? null,
    [state.profiles]
  );

  const getSecretById = useCallback(
    (id: string): SecretConfig => state.secrets[id] ?? {},
    [state.secrets]
  );

  // When a profile is deleted, clean up its connection entry
  useEffect(() => {
    const profileIdSet = new Set(state.profiles.map((item) => item.id));
    setActiveConnectionIdsByEngine((prev) => {
      let changed = false;
      const next: Partial<Record<EngineKey, string[]>> = { ...prev };

      (Object.keys(next) as EngineKey[]).forEach((engine) => {
        const ids = next[engine];
        if (ids) {
          const filtered = ids.filter((c) => profileIdSet.has(c));
          if (filtered.length !== ids.length) {
            next[engine] = filtered.length > 0 ? filtered : undefined;
            changed = true;
          }
        }
      });

      return changed ? next : prev;
    });
  }, [state.profiles]);

  const activeConnectionId = activeEngine ? activeConnectionIdsByEngine[activeEngine]?.find(
    (id) => focusedConnectionIdByEngine[activeEngine] === id
  ) ?? activeConnectionIdsByEngine[activeEngine]?.[0] : undefined;

  const value = useMemo(() => ({
    profiles: state.profiles,
    getSecretById,
    activeConnectionId,
    activeEngine,
    activeConnectionIdByEngine,
    activeConnectionIdsByEngine,
    focusedConnectionIdByEngine,
    focusedConnectionIdRef,
    getActiveConnectionIdByEngine,
    getFocusedConnectionIdByEngine,
    saveConnection,
    deleteConnection,
    setActiveConnection,
    activateConnection,
    focusConnection,
    disconnectActiveConnection,
    deactivateConnection,
    getProfileById,
    lastConnectionId: state.lastConnectionId
  }), [
    state.profiles,
    activeConnectionId,
    activeEngine,
    activeConnectionIdByEngine,
    activeConnectionIdsByEngine,
    focusedConnectionIdByEngine,
    focusedConnectionIdRef,
    getSecretById,
    getActiveConnectionIdByEngine,
    getFocusedConnectionIdByEngine,
    saveConnection,
    deleteConnection,
    setActiveConnection,
    activateConnection,
    focusConnection,
    disconnectActiveConnection,
    deactivateConnection,
    getProfileById,
    state.lastConnectionId
  ]);

  return (
    <SharedConnectionStateContext.Provider value={value}>
      {children}
    </SharedConnectionStateContext.Provider>
  );
}

export function useSharedConnectionState() {
  const ctx = useContext(SharedConnectionStateContext);
  if (!ctx) {
    throw new Error("SharedConnectionState not initialized");
  }
  return ctx;
}
