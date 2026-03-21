import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { logError } from "../lib/errorLog";
import { loadState, saveState } from "../lib/storage";
import type { ConnectionProfile, LocalState, SecretConfig } from "../lib/types";

const normalizeProfile = (profile: ConnectionProfile): ConnectionProfile => ({
  ...profile,
  engine: profile.engine ?? "elasticsearch",
  ssh: {
    enabled: profile.ssh?.enabled ?? false,
    host: profile.ssh?.host ?? "",
    port: profile.ssh?.port ?? 22,
    username: profile.ssh?.username ?? ""
  }
});

const defaultState: LocalState = {
  profiles: [],
  secrets: {}
};

interface SharedConnectionStateValue {
  profiles: ConnectionProfile[];
  secrets: Record<string, SecretConfig>;
  saveConnection: (profile: ConnectionProfile, secret: SecretConfig) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
  lastConnectionId?: string;
}

const SharedConnectionStateContext = createContext<SharedConnectionStateValue | null>(null);

export function SharedConnectionStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LocalState>(defaultState);

  useEffect(() => {
    loadState()
      .then((loaded) => {
        const normalizedProfiles = (loaded.profiles ?? [])
          .map((item) => normalizeProfile(item));
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
    const normalizedProfile = normalizeProfile(profile);
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
    await persist(nextState);
  }, [state, persist]);

  const value = useMemo(() => ({
    profiles: state.profiles,
    secrets: state.secrets,
    saveConnection,
    deleteConnection,
    lastConnectionId: state.lastConnectionId
  }), [state.profiles, state.secrets, saveConnection, deleteConnection, state.lastConnectionId]);

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
