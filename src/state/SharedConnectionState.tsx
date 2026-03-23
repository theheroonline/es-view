import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getProfileEngine, normalizeConnectionProfile } from "../lib/connection/profile";
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
  activeConnectionIdByEngine: Partial<Record<EngineKey, string>>;
  getActiveConnectionIdByEngine: (engine: EngineKey) => string | undefined;
  saveConnection: (profile: ConnectionProfile, secret: SecretConfig) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
  setActiveConnection: (id: string) => Promise<void>;
  disconnectActiveConnection: (connectionId?: string) => Promise<void>;
  getProfileById: (id: string) => ConnectionProfile | null;
  lastConnectionId?: string;
}

const SharedConnectionStateContext = createContext<SharedConnectionStateValue | null>(null);

export function SharedConnectionStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LocalState>(defaultState);
  const [connectedConnectionId, setConnectedConnectionId] = useState<string | undefined>(undefined);
  const [activeConnectionIdByEngine, setActiveConnectionIdByEngine] = useState<Partial<Record<EngineKey, string>>>({});

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

  const persist = useCallback(async (nextState: LocalState) => {
    await saveState(nextState);
    setState(nextState);
  }, []);

  const saveConnection = useCallback(async (profile: ConnectionProfile, secret: SecretConfig) => {
    const profiles = [...state.profiles];
    const index = profiles.findIndex((item) => item.id === profile.id);
    const normalizedProfile = normalizeConnectionProfile(profile);
    if (index >= 0) {
      profiles[index] = normalizedProfile;
    } else {
      profiles.push(normalizedProfile);
    }
    const nextState: LocalState = {
      ...state,
      profiles,
      secrets: {
        ...state.secrets,
        [profile.id]: secret
      },
      lastConnectionId: normalizedProfile.id
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
    if (connectedConnectionId === id) {
      setConnectedConnectionId(undefined);
    }
    setActiveConnectionIdByEngine((prev) => {
      const next = { ...prev };
      (Object.keys(next) as EngineKey[]).forEach((engine) => {
        if (next[engine] === id) {
          delete next[engine];
        }
      });
      return next;
    });
    await persist(nextState);
  }, [state, persist, connectedConnectionId]);

  const getActiveConnectionIdByEngine = useCallback(
    (engine: EngineKey) => activeConnectionIdByEngine[engine],
    [activeConnectionIdByEngine]
  );

  const setActiveConnection = useCallback(async (id: string) => {
    const profile = state.profiles.find((item) => item.id === id);
    const engine = getProfileEngine(profile);

    setConnectedConnectionId(id);
    setActiveConnectionIdByEngine((prev) => ({
      ...prev,
      [engine]: id
    }));

    await persist({ ...state, lastConnectionId: id });
  }, [state, persist]);

  const disconnectActiveConnection = useCallback(async (connectionId?: string) => {
    const targetId = connectionId ?? connectedConnectionId;
    if (!targetId) {
      return;
    }

    const targetProfile = state.profiles.find((item) => item.id === targetId);
    const targetEngine = getProfileEngine(targetProfile);

    setActiveConnectionIdByEngine((prev) => {
      if (prev[targetEngine] !== targetId) {
        return prev;
      }
      const next = { ...prev };
      delete next[targetEngine];
      return next;
    });

    if (connectedConnectionId === targetId) {
      setConnectedConnectionId(undefined);
    }
  }, [connectedConnectionId, state.profiles]);

  const getProfileById = useCallback(
    (id: string): ConnectionProfile | null => state.profiles.find((item) => item.id === id) ?? null,
    [state.profiles]
  );

  // Keep secrets access behind a getter so consumers don't depend on LocalState internals.
  const getSecretById = useCallback(
    (id: string): SecretConfig => state.secrets[id] ?? {},
    [state.secrets]
  );

  useEffect(() => {
    if (!connectedConnectionId) return;
    const exists = state.profiles.some((item) => item.id === connectedConnectionId);
    if (!exists) {
      setConnectedConnectionId(undefined);
    }
  }, [connectedConnectionId, state.profiles]);

  useEffect(() => {
    setActiveConnectionIdByEngine((prev) => {
      const profileIdSet = new Set(state.profiles.map((item) => item.id));
      let changed = false;
      const next: Partial<Record<EngineKey, string>> = { ...prev };

      (Object.keys(next) as EngineKey[]).forEach((engine) => {
        const id = next[engine];
        if (id && !profileIdSet.has(id)) {
          delete next[engine];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [state.profiles]);

  const value = useMemo(() => ({
    profiles: state.profiles,
    getSecretById,
    activeConnectionId: connectedConnectionId,
    activeConnectionIdByEngine,
    getActiveConnectionIdByEngine,
    saveConnection,
    deleteConnection,
    setActiveConnection,
    disconnectActiveConnection,
    getProfileById,
    lastConnectionId: state.lastConnectionId
  }), [
    state.profiles,
    connectedConnectionId,
    activeConnectionIdByEngine,
    getSecretById,
    getActiveConnectionIdByEngine,
    saveConnection,
    deleteConnection,
    setActiveConnection,
    disconnectActiveConnection,
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
