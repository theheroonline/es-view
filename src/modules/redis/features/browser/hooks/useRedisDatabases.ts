import { useCallback, useMemo } from "react";
import { logError } from "../../../../../lib/errorLog";
import type { RedisConnection, RedisDatabaseInfo } from "../../../types";
import { loadRedisDatabases } from "../services/queryService";

interface UseRedisDatabasesProps {
  activeRedisConnection: RedisConnection | null;
  currentDatabase: number;
  databases: RedisDatabaseInfo[];
  selectedDatabase: number | null;
  setDatabases: (databases: RedisDatabaseInfo[]) => void;
  setSelectedDatabase: (database: number | null) => void;
  setError: (message: string) => void;
}

export function useRedisDatabases({
  activeRedisConnection,
  currentDatabase,
  databases,
  selectedDatabase,
  setDatabases,
  setSelectedDatabase,
  setError,
}: UseRedisDatabasesProps) {
  const refreshDatabases = useCallback(async () => {
    if (!activeRedisConnection) {
      return;
    }

    setError("");
    try {
      const items = await loadRedisDatabases(activeRedisConnection.id);
      setDatabases(items);
      if (selectedDatabase === null) {
        setSelectedDatabase(activeRedisConnection.database);
      }
    } catch (err) {
      logError(err, {
        source: "redisBrowser.loadDatabases",
        message: `Failed to load Redis databases for ${activeRedisConnection.name}`
      });
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [activeRedisConnection, selectedDatabase, setDatabases, setError, setSelectedDatabase]);

  const databaseOptions = useMemo(() => {
    if (databases.length > 0) {
      return databases;
    }

    return [{ index: currentDatabase, label: `DB${currentDatabase}`, keyCount: undefined, isDefault: true }];
  }, [currentDatabase, databases]);

  return {
    databaseOptions,
    refreshDatabases,
  };
}
