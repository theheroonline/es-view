import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { logError } from "../lib/errorLog";
import { listEsIndices } from "../modules/es/services/clusterService";
import type { EsConnection, IndexMeta } from "../modules/es/types";
import { useSharedConnectionState } from "./SharedConnectionState";

const isSystemIndex = (name: string) => name.startsWith(".");

interface ElasticsearchContextValue {
  activeConnection: EsConnection | null;
  getActiveConnection: () => EsConnection | null;
  getConnectionById: (id: string) => EsConnection | null;
  indices: string[];
  indicesMeta: IndexMeta[];
  refreshIndices: (connection?: EsConnection | null) => Promise<void>;
  selectedIndex: string | undefined;
  setSelectedIndex: (index: string | undefined) => void;
}

const ElasticsearchContext = createContext<ElasticsearchContextValue | null>(null);

export function ElasticsearchProvider({ children }: { children: ReactNode }) {
  const { profiles, getSecretById, getActiveConnectionIdByEngine } = useSharedConnectionState();
  const [selectedIndex, setSelectedIndexState] = useState<string | undefined>(undefined);
  const [indices, setIndices] = useState<string[]>([]);
  const [indicesMeta, setIndicesMeta] = useState<IndexMeta[]>([]);
  const [indicesCacheByConnection, setIndicesCacheByConnection] = useState<Record<string, { indices: string[]; indicesMeta: IndexMeta[] }>>({});

  const activeEsConnectionId = getActiveConnectionIdByEngine("elasticsearch");

  const setSelectedIndex = useCallback((index: string | undefined) => {
    setSelectedIndexState(index);
  }, []);

  const getConnectionById = useCallback((id: string): EsConnection | null => {
    const profile = profiles.find((item) => item.id === id);
    if (!profile || (profile.engine ?? "elasticsearch") !== "elasticsearch") {
      return null;
    }

    const secret = getSecretById(id);
    return {
      ...profile,
      engine: profile.engine ?? "elasticsearch",
      ssh: {
        enabled: profile.ssh?.enabled ?? false,
        host: profile.ssh?.host ?? "",
        port: profile.ssh?.port ?? 22,
        username: profile.ssh?.username ?? ""
      },
      username: secret.username,
      password: secret.password,
      apiKey: secret.apiKey,
      sshPassword: secret.sshPassword
    };
  }, [getSecretById, profiles]);

  const getActiveConnection = useCallback((): EsConnection | null => {
    if (!activeEsConnectionId) return null;
    return getConnectionById(activeEsConnectionId);
  }, [activeEsConnectionId, getConnectionById]);

  const refreshIndices = useCallback(async (connection?: EsConnection | null) => {
    const target = connection ?? getActiveConnection();
    if (!target) {
      setIndices([]);
      setIndicesMeta([]);
      return;
    }

    if ((target.engine ?? "elasticsearch") !== "elasticsearch") {
      setIndices([]);
      setIndicesMeta([]);
      return;
    }

    try {
      const data = await listEsIndices(target);
      const mapped: IndexMeta[] = data
        .map((item) => ({
          index: item.index,
          health: item.health,
          docsCount: item["docs.count"] ?? (item as { docsCount?: string }).docsCount
        }))
        .filter((item) => !isSystemIndex(item.index));
      const nextIndices = mapped.map((item) => item.index);

      setIndices(nextIndices);
      setIndicesMeta(mapped);
      setIndicesCacheByConnection((prev) => ({
        ...prev,
        [target.id]: {
          indices: nextIndices,
          indicesMeta: mapped
        }
      }));

      setSelectedIndexState((prev) => {
        if (prev && !nextIndices.includes(prev)) return undefined;
        return prev;
      });
    } catch (error) {
      logError(error, {
        source: "elasticsearchContext.refreshIndices",
        message: `Failed to refresh Elasticsearch indices for ${target.name}`
      });
      setIndices([]);
      setIndicesMeta([]);
    }
  }, [getActiveConnection]);

  useEffect(() => {
    if (!activeEsConnectionId) {
      setSelectedIndexState(undefined);
      setIndices([]);
      setIndicesMeta([]);
      return;
    }

    const cached = indicesCacheByConnection[activeEsConnectionId];
    if (!cached) {
      setIndices([]);
      setIndicesMeta([]);
      return;
    }

    setIndices(cached.indices);
    setIndicesMeta(cached.indicesMeta);
    setSelectedIndexState((prev) => {
      if (prev && !cached.indices.includes(prev)) return undefined;
      return prev;
    });
  }, [activeEsConnectionId, indicesCacheByConnection]);

  useEffect(() => {
    setIndicesCacheByConnection((prev) => {
      const profileIdSet = new Set(profiles.map((item) => item.id));
      let changed = false;
      const next = { ...prev };

      Object.keys(next).forEach((connectionId) => {
        if (!profileIdSet.has(connectionId)) {
          delete next[connectionId];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [profiles]);

  const activeConnection = useMemo(() => getActiveConnection(), [getActiveConnection]);

  const value = useMemo(() => ({
    activeConnection,
    getActiveConnection,
    getConnectionById,
    indices,
    indicesMeta,
    refreshIndices,
    selectedIndex,
    setSelectedIndex
  }), [activeConnection, getActiveConnection, getConnectionById, indices, indicesMeta, refreshIndices, selectedIndex, setSelectedIndex]);

  return <ElasticsearchContext.Provider value={value}>{children}</ElasticsearchContext.Provider>;
}

export function useElasticsearchContext() {
  const ctx = useContext(ElasticsearchContext);
  if (!ctx) {
    throw new Error("ElasticsearchContext not initialized");
  }
  return ctx;
}
