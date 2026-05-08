import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { logError } from "../lib/errorLog";
import type { ConnectionProfile } from "../lib/types";
import { pingEsCluster } from "../modules/es/services/clusterService";
import { mysqlConnect, mysqlDisconnect, mysqlListDatabases } from "../modules/mysql/services/client";
import { redisConnect, redisDisconnect } from "../modules/redis/services/connectionClient";
import { useElasticsearchContext } from "../state/ElasticsearchContext";
import { useMysqlContext } from "../state/MysqlContext";
import { useRedisContext } from "../state/RedisContext";
import { useSharedConnectionState } from "../state/SharedConnectionState";

export type ConnectionStatus = "success" | "idle" | "failed" | "connecting";
export type EngineType = "elasticsearch" | "mysql" | "redis";

interface ConnectionContextMenuState {
  connectionId: string;
  x: number;
  y: number;
}

interface EngineConfig {
  defaultRoute: string;
  label: string;
  needsConnect: boolean;
  needsDisconnect: boolean;
  connectionsRoute: string;
}

const ENGINE_CONFIG: Record<EngineType, EngineConfig> = {
  elasticsearch: {
    defaultRoute: "/data",
    label: "Elasticsearch",
    needsConnect: false,
    needsDisconnect: false,
    connectionsRoute: "/es/connections",
  },
  mysql: {
    defaultRoute: "/mysql/tables",
    label: "MySQL",
    needsConnect: true,
    needsDisconnect: true,
    connectionsRoute: "/mysql/connections",
  },
  redis: {
    defaultRoute: "/redis/browser",
    label: "Redis",
    needsConnect: true,
    needsDisconnect: true,
    connectionsRoute: "/redis/connections",
  },
};

export function useConnectionWorkspace() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refreshIndices, getConnectionById: getEsConnectionById } = useElasticsearchContext();
  const {
    profiles,
    activeConnectionId,
    activeEngine: sharedActiveEngine,
    activeConnectionIdsByEngine,
    focusedConnectionIdByEngine,
    activateConnection,
    focusConnection,
    deactivateConnection,
    disconnectActiveConnection,
    deleteConnection,
  } = useSharedConnectionState();
  const {
    getMysqlConnectionById,
    resetWorkspaceForConnection: resetMysqlWorkspaceForConnection,
    setDatabasesForConnection,
  } = useMysqlContext();
  const {
    setSelectedDatabase: setSelectedRedisDatabase,
    getRedisConnectionById,
  } = useRedisContext();

  const esProfiles = useMemo(
    () => profiles.filter((item) => (item.engine ?? "elasticsearch") === "elasticsearch"),
    [profiles]
  );
  const mysqlProfiles = useMemo(
    () => profiles.filter((item) => item.engine === "mysql"),
    [profiles]
  );
  const redisProfiles = useMemo(
    () => profiles.filter((item) => item.engine === "redis"),
    [profiles]
  );
  const allProfiles = useMemo(
    () => [...esProfiles, ...mysqlProfiles, ...redisProfiles],
    [esProfiles, mysqlProfiles, redisProfiles]
  );

  const activeProfile = activeConnectionId
    ? profiles.find((profile) => profile.id === activeConnectionId) ?? null
    : null;
  const activeEngine = (sharedActiveEngine ?? null) as EngineType | null;

  const [focusedConnectionId, setFocusedConnectionId] = useState<string | undefined>(undefined);
  const [contextMenu, setContextMenu] = useState<ConnectionContextMenuState | null>(null);
  const [isConnectionActionPending, setIsConnectionActionPending] = useState(false);
  const [connectionActionError, setConnectionActionError] = useState("");
  const [connectionStatusById, setConnectionStatusById] = useState<Record<string, ConnectionStatus>>({});
  const pendingConnectionRef = useRef<Map<string, Promise<boolean>>>(new Map());
  const [isWorkspaceSuspendedByEngine, setIsWorkspaceSuspendedByEngine] = useState<Record<EngineType, boolean>>({
    elasticsearch: false,
    mysql: false,
    redis: false,
  });

  // Backward-compat shim: engine → focused connection ID
  const activeConnectionIdByEngine = useMemo(() => {
    const result: Partial<Record<EngineType, string>> = {};
    (Object.keys(focusedConnectionIdByEngine) as EngineType[]).forEach((eng) => {
      result[eng] = focusedConnectionIdByEngine[eng];
    });
    return result;
  }, [focusedConnectionIdByEngine]);

  const activeConnectionStatus = activeConnectionId ? connectionStatusById[activeConnectionId] ?? "idle" : "idle";
  const activeEngineLabel = activeEngine ? ENGINE_CONFIG[activeEngine]?.label ?? "" : "";

  const markConnectionSuccess = (connectionId: string) => {
    setConnectionStatusById((prev) => ({
      ...prev,
      [connectionId]: "success",
    }));
  };

  const switchViewSync = async (connectionId: string, engine: EngineType) => {
    setConnectionActionError("");
    setIsWorkspaceSuspendedByEngine((prev) => ({ ...prev, [engine]: false }));
    await activateConnection(connectionId, engine, true);
  };

  const resetMysqlWorkspace = (connectionId: string) => {
    resetMysqlWorkspaceForConnection(connectionId);
  };

  const getProfileById = useCallback(
    (connectionId?: string | null): ConnectionProfile | null => {
      if (!connectionId) {
        return null;
      }

      return profiles.find((profile) => profile.id === connectionId) ?? null;
    },
    [profiles]
  );

  const disconnectConnectionForEdit = async (connectionId?: string) => {
    if (!connectionId) {
      return;
    }

    const currentProfile = getProfileById(connectionId);
    const engine = (currentProfile?.engine ?? "elasticsearch") as EngineType;
    const config = ENGINE_CONFIG[engine];

    if ((connectionStatusById[connectionId] ?? "idle") === "success" && config.needsDisconnect) {
      try {
        if (engine === "mysql") {
          await mysqlDisconnect(connectionId);
        } else if (engine === "redis") {
          await redisDisconnect(connectionId);
        }
      } catch (error) {
        logError(error, {
          source: `app.connection.${engine}.disconnectBeforeEdit`,
          message: `Failed to disconnect ${engine} connection ${connectionId} before editing config`,
        });
      }
    }

    await disconnectActiveConnection(connectionId, engine);
    setIsWorkspaceSuspendedByEngine((prev) => ({ ...prev, [engine]: false }));
    if (focusedConnectionIdByEngine[engine] === connectionId) {
      resetMysqlWorkspace(connectionId);
      setSelectedRedisDatabase(null);
    }
    setConnectionStatusById((prev) => ({
      ...prev,
      [connectionId]: "idle",
    }));
  };

  const openConnectionConfig = async (
    _engine: EngineType,
    _action: "add" | "edit" | "copy",
    connectionId?: string
  ) => {
    if (_action === "edit") {
      await disconnectConnectionForEdit(connectionId);
    }
  };

  const handleConnectionChange = async (connectionId: string, options?: { forceValidate?: boolean }) => {
    const profile = getProfileById(connectionId);
    const engine = (profile?.engine ?? "elasticsearch") as EngineType;
    const config = ENGINE_CONFIG[engine];

    const alreadyActive = activeConnectionIdsByEngine[engine]?.includes(connectionId);
    const alreadyFocused = focusedConnectionIdByEngine[engine] === connectionId;

    // Scenario A: already focused AND current engine is active → just wake up if suspended
    if (alreadyFocused && activeEngine === engine) {
      if (isWorkspaceSuspendedByEngine[engine]) {
        setConnectionActionError("");
        setIsWorkspaceSuspendedByEngine((prev) => ({ ...prev, [engine]: false }));
        await navigate(config.defaultRoute);
      }
      return true;
    }

    if (!profile) {
      setConnectionActionError(t("connections.connectionFailedSimple"));
      return false;
    }

    // Scenario B: already active but not focused → switch focus and restore workspace
    if (alreadyActive) {
      focusConnection(connectionId, engine);
      setIsWorkspaceSuspendedByEngine((prev) => ({ ...prev, [engine]: false }));
      markConnectionSuccess(connectionId);

      // Restore workspace data for the connection we're focusing
      if (engine === "mysql") {
        try {
          const databases = await mysqlListDatabases(connectionId);
          setDatabasesForConnection(connectionId, databases);
        } catch (error) {
          logError(error, {
            source: "app.connection.mysql.listDatabases",
            message: "Failed to restore MySQL databases after switching focus",
          });
          setDatabasesForConnection(connectionId, []);
        }
      }

      await navigate(config.defaultRoute);
      return true;
    }

    // Scenario C: new connection → activate + backend connect

    // Dedup: if this connectionId is already connecting, reuse the in-flight promise
    const existing = pendingConnectionRef.current.get(connectionId);
    if (existing) {
      return existing;
    }

    const connectPromise = (async () => {
      setIsConnectionActionPending(true);
      setConnectionActionError("");
      setContextMenu(null);
      setConnectionStatusById((prev) => ({ ...prev, [connectionId]: "connecting" }));

      const currentStatus = connectionStatusById[connectionId] ?? "idle";
      const shouldValidate = options?.forceValidate ?? currentStatus !== "success";

      try {
        if (engine === "mysql") {
          const mysqlConnection = getMysqlConnectionById(connectionId);
          if (!mysqlConnection) {
            throw new Error("CONNECTION_FAILED");
          }

          await switchViewSync(connectionId, "mysql");
          resetMysqlWorkspace(connectionId);

          if (shouldValidate) {
            try {
              await mysqlConnect(mysqlConnection);
            } catch (error) {
              logError(error, {
                source: "app.connection.mysql.connect",
                message: `Failed to connect to MySQL database ${mysqlConnection.name}`,
              });
              throw error;
            }
          }

          try {
            const databases = await mysqlListDatabases(connectionId);
            setDatabasesForConnection(connectionId, databases);
          } catch (error) {
            logError(error, {
              source: "app.connection.mysql.listDatabases",
              message: "Failed to load MySQL databases after switching connection",
            });
            setDatabasesForConnection(connectionId, []);
          }

          markConnectionSuccess(connectionId);
          await navigate(config.defaultRoute);
          return true;
        }

        if (engine === "redis") {
          const redisConnection = getRedisConnectionById(connectionId);
          if (!redisConnection) {
            throw new Error("CONNECTION_FAILED");
          }

          await switchViewSync(connectionId, "redis");
          setSelectedRedisDatabase(redisConnection.database ?? 0);

          if (shouldValidate) {
            await redisConnect(redisConnection);
          }

          markConnectionSuccess(connectionId);
          await navigate(config.defaultRoute);
          return true;
        }

        // elasticsearch
        const connection = getEsConnectionById(connectionId);
        if (!connection) {
          throw new Error("CONNECTION_FAILED");
        }

        await switchViewSync(connectionId, "elasticsearch");

        if (shouldValidate) {
          await pingEsCluster(connection);
        }

        if (shouldValidate) {
          await refreshIndices(connection);
        }

        markConnectionSuccess(connectionId);
        await navigate(config.defaultRoute);
        return true;
      } catch (error) {
        logError(error, {
          source: "app.connection.change",
          message: `Failed to activate connection ${connectionId}`,
        });
        await disconnectActiveConnection(connectionId, engine);
        setConnectionStatusById((prev) => ({
          ...prev,
          [connectionId]: "failed",
        }));
        setIsWorkspaceSuspendedByEngine((prev) => ({ ...prev, [engine]: true }));

        // 新连接失败时，如果还有其他引擎的活跃连接，切回旧连接
        const engines: EngineType[] = ["mysql", "redis", "elasticsearch"];
        for (const eng of engines) {
          const ids = activeConnectionIdsByEngine[eng];
          if (ids && ids.length > 0) {
            focusConnection(ids[0], eng);
            break;
          }
        }

        await navigate("/", { replace: true });
        setConnectionActionError(t("connections.connectionFailedSimple"));
        return false;
      } finally {
        setIsConnectionActionPending(false);
        pendingConnectionRef.current.delete(connectionId);
        setConnectionStatusById((prev) => {
          if (prev[connectionId] === "connecting") {
            const next = { ...prev };
            delete next[connectionId];
            return next;
          }
          return prev;
        });
      }

      return false;
    })();

    pendingConnectionRef.current.set(connectionId, connectPromise);
    return connectPromise;
  };

  const handleDisconnect = async (connectionId?: string) => {
    const targetConnectionId = connectionId ?? (sharedActiveEngine ? focusedConnectionIdByEngine[sharedActiveEngine] : undefined);
    if (isConnectionActionPending || !targetConnectionId) {
      return;
    }

    setIsConnectionActionPending(true);
    setContextMenu(null);
    const currentProfile = getProfileById(targetConnectionId);
    const engine = (currentProfile?.engine ?? "elasticsearch") as EngineType;

    try {
      if (ENGINE_CONFIG[engine].needsDisconnect) {
        try {
          if (engine === "mysql") {
            await mysqlDisconnect(targetConnectionId);
          } else if (engine === "redis") {
            await redisDisconnect(targetConnectionId);
          }
        } catch (error) {
          logError(error, {
            source: `app.connection.${engine}.disconnect`,
            message: `Failed to disconnect ${engine} connection ${targetConnectionId}`,
          });
        }
      }

      deactivateConnection(targetConnectionId, engine);
      setIsWorkspaceSuspendedByEngine((prev) => ({ ...prev, [engine]: false }));
      setConnectionStatusById((prev) => {
        const next = { ...prev };
        delete next[targetConnectionId];
        return next;
      });

      // If no connections remain for this engine, navigate away
      const remaining = activeConnectionIdsByEngine[engine]?.filter((c) => c !== targetConnectionId) ?? [];
      if (remaining.length === 0) {
        await navigate("/", { replace: true });
      }
    } finally {
      setIsConnectionActionPending(false);
    }
  };

  const handleConnectionContextMenu = (event: MouseEvent<HTMLElement>, connectionId: string) => {
    event.preventDefault();
    setFocusedConnectionId(connectionId);
    setContextMenu({ connectionId, x: event.clientX, y: event.clientY });
  };

  const closeConnectionContextMenu = () => {
    setContextMenu(null);
  };

  const handleDeleteConnection = async (connectionId: string) => {
    setContextMenu(null);
    setConnectionStatusById((prev) => {
      const next = { ...prev };
      delete next[connectionId];
      return next;
    });
    await deleteConnection(connectionId);
  };

  const ensureMysqlConnectionReady = async (connectionId: string) => {
    const profile = getProfileById(connectionId);
    if (profile?.engine !== "mysql") {
      return false;
    }

    const status = connectionStatusById[connectionId] ?? "idle";
    const isActive = activeConnectionIdsByEngine.mysql?.includes(connectionId);
    const isFocused = focusedConnectionIdByEngine.mysql === connectionId;

    if (isActive && isFocused && status === "success" && !isWorkspaceSuspendedByEngine.mysql) {
      return true;
    }

    return handleConnectionChange(connectionId, { forceValidate: true });
  };

  useEffect(() => {
    if (!focusedConnectionId && allProfiles.length > 0) {
      setFocusedConnectionId(allProfiles[0]?.id);
      return;
    }

    if (focusedConnectionId && !allProfiles.some((item) => item.id === focusedConnectionId)) {
      setFocusedConnectionId(allProfiles[0]?.id);
    }
  }, [focusedConnectionId, allProfiles]);

  useEffect(() => {
    setConnectionStatusById((prev) => {
      const next: Record<string, ConnectionStatus> = {};
      allProfiles.forEach((item) => {
        next[item.id] = prev[item.id] ?? "idle";
      });

      if (Object.keys(prev).length !== Object.keys(next).length) {
        return next;
      }

      for (const key of Object.keys(next)) {
        if (prev[key] !== next[key]) {
          return next;
        }
      }

      return prev;
    });
  }, [allProfiles]);

  useEffect(() => {
    const engines: EngineType[] = ["elasticsearch", "mysql", "redis"];
    for (const eng of engines) {
      const hasActive = activeConnectionIdsByEngine[eng] && activeConnectionIdsByEngine[eng]!.length > 0;
      if (isWorkspaceSuspendedByEngine[eng] && !hasActive) {
        setIsWorkspaceSuspendedByEngine((prev) => ({ ...prev, [eng]: false }));
      }
    }
  }, [activeConnectionIdsByEngine, isWorkspaceSuspendedByEngine]);

  const isWorkspaceSuspended = activeEngine ? isWorkspaceSuspendedByEngine[activeEngine] : false;

  return {
    profiles,
    activeConnectionId,
    activeProfile,
    activeEngine,
    activeEngineLabel,
    activeConnectionStatus,
    esProfiles,
    mysqlProfiles,
    redisProfiles,
    allProfiles,
    focusedConnectionId,
    setFocusedConnectionId,
    contextMenu,
    closeConnectionContextMenu,
    isConnectionActionPending,
    connectionActionError,
    setConnectionActionError,
    connectionStatusById,
    pendingConnectionRef,
    activeConnectionIdByEngine,
    activeConnectionIdsByEngine,
    focusedConnectionIdByEngine,
    isWorkspaceSuspended,
    handleConnectionChange,
    handleDisconnect,
    handleConnectionContextMenu,
    handleDeleteConnection,
    openConnectionConfig,
    ensureMysqlConnectionReady,
    getProfileById,
  };
}
