import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { RedisConnection, RedisWorkspaceState } from "../modules/redis/types";
import { useSharedConnectionState } from "./SharedConnectionState";

interface RedisContextValue {
  activeRedisConnection: RedisConnection | null;
  selectedDatabase: RedisWorkspaceState["selectedDatabase"];
  setSelectedDatabase: (database: number | null) => void;
  getRedisConnectionById: (id: string) => RedisConnection | null;
}

const RedisContext = createContext<RedisContextValue | null>(null);

export function RedisProvider({ children }: { children: ReactNode }) {
  const { profiles, getSecretById, getFocusedConnectionIdByEngine } = useSharedConnectionState();
  const [selectedDbByConnection, setSelectedDbByConnection] = useState<Record<string, number | null>>({});
  const activeConnectionId = getFocusedConnectionIdByEngine("redis");

  const getRedisConnectionById = useCallback(
    (id: string): RedisConnection | null => {
      const profile = profiles.find((item) => item.id === id);
      if (!profile || profile.engine !== "redis") {
        return null;
      }

      const secret = getSecretById(id);
      return {
        id: profile.id,
        name: profile.name,
        engine: profile.engine,
        host: profile.redisHost ?? "127.0.0.1",
        port: profile.redisPort ?? 6379,
        database: profile.redisDatabase ?? 0,
        username: secret.username,
        password: secret.password,
        ssh: profile.ssh,
        sshPassword: secret.sshPassword,
      };
    },
    [getSecretById, profiles]
  );

  const activeRedisConnection = useMemo(() => {
    if (!activeConnectionId) {
      return null;
    }

    return getRedisConnectionById(activeConnectionId);
  }, [activeConnectionId, getRedisConnectionById]);

  const selectedDatabase = activeConnectionId
    ? (selectedDbByConnection[activeConnectionId] ?? null)
    : null;

  const setSelectedDatabase = useCallback((database: number | null) => {
    if (!activeConnectionId) return;
    setSelectedDbByConnection((prev) => ({
      ...prev,
      [activeConnectionId]: database,
    }));
  }, [activeConnectionId]);

  const value = useMemo(
    () => ({
      activeRedisConnection,
      selectedDatabase,
      setSelectedDatabase,
      getRedisConnectionById,
    }),
    [
      activeRedisConnection,
      selectedDatabase,
      setSelectedDatabase,
      getRedisConnectionById,
    ]
  );

  return <RedisContext.Provider value={value}>{children}</RedisContext.Provider>;
}

export function useRedisContext() {
  const context = useContext(RedisContext);
  if (!context) {
    throw new Error("RedisContext not initialized");
  }

  return context;
}
