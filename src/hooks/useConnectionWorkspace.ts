import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
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

export type ConnectionStatus = "success" | "idle" | "failed";
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
  const { refreshIndices, getConnectionById } = useElasticsearchContext();
  const {
    profiles,
    activeConnectionId,
    activeConnectionIdByEngine,
    getActiveConnectionIdByEngine,
    setActiveConnection,
    disconnectActiveConnection,
    deleteConnection,
  } = useSharedConnectionState();
  const {
    setDatabases,
    setTablesByDb,
    setExpandedDatabase,
    setSelectedDatabase,
    setSelectedTable,
    setOpenedTables,
    setActiveOpenedTableKey,
    getMysqlConnectionById,
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
  const activeEngine = activeProfile?.engine ?? null as EngineType | null;

  const [focusedConnectionId, setFocusedConnectionId] = useState<string | undefined>(undefined);
  const [contextMenu, setContextMenu] = useState<ConnectionContextMenuState | null>(null);
  const [isConnectionActionPending, setIsConnectionActionPending] = useState(false);
  const [connectionActionError, setConnectionActionError] = useState("");
  const [connectionStatusById, setConnectionStatusById] = useState<Record<string, ConnectionStatus>>({});
  const [isWorkspaceSuspended, setIsWorkspaceSuspended] = useState(false);

  const activeConnectionStatus = activeConnectionId ? connectionStatusById[activeConnectionId] ?? "idle" : "idle";
  const activeEngineLabel = activeEngine ? ENGINE_CONFIG[activeEngine]?.label ?? "" : "";

  const markConnectionSuccess = (connectionId: string) => {
    setConnectionStatusById((prev) => ({
      ...prev,
      [connectionId]: "success",
    }));
  };

  const resetMysqlWorkspace = () => {
    setTablesByDb({});
    setExpandedDatabase(null);
    setSelectedDatabase(undefined);
    setSelectedTable(undefined);
    setOpenedTables([]);
    setActiveOpenedTableKey(null);
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

    await disconnectActiveConnection(connectionId);
    setIsWorkspaceSuspended(false);
    if (connectionId === activeConnectionId) {
      resetMysqlWorkspace();
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
    if (isConnectionActionPending) {
      return false;
    }

    if (activeConnectionId === connectionId) {
      if (isWorkspaceSuspended) {
        setConnectionActionError("");
        setIsWorkspaceSuspended(false);
        const profile = getProfileById(connectionId);
        const engine = (profile?.engine ?? "elasticsearch") as EngineType;
        const targetRoute = ENGINE_CONFIG[engine]?.defaultRoute ?? "/data";
        await navigate(targetRoute);
      }

      return true;
    }

    setIsConnectionActionPending(true);
    setConnectionActionError("");
    setContextMenu(null);

    const profile = getProfileById(connectionId);
    if (!profile) {
      setIsConnectionActionPending(false);
      setConnectionActionError(t("connections.connectionFailedSimple"));
      return false;
    }

    const engine = (profile.engine ?? "elasticsearch") as EngineType;
    const config = ENGINE_CONFIG[engine];

    try {
      const currentStatus = connectionStatusById[connectionId] ?? "idle";
      const shouldValidate = options?.forceValidate ?? currentStatus !== "success";

      if (engine === "mysql") {
        const mysqlConnection = getMysqlConnectionById(connectionId);
        if (!mysqlConnection) {
          throw new Error("CONNECTION_FAILED");
        }

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

        await setActiveConnection(connectionId);

        try {
          const databases = await mysqlListDatabases(connectionId);
          setDatabases(databases);
        } catch (error) {
          logError(error, {
            source: "app.connection.mysql.listDatabases",
            message: "Failed to load MySQL databases after switching connection",
          });
          setDatabases([]);
        }

        resetMysqlWorkspace();
        markConnectionSuccess(connectionId);
        setIsWorkspaceSuspended(false);
        await navigate(config.defaultRoute);
        return true;
      }

      if (engine === "redis") {
        const redisConnection = getRedisConnectionById(connectionId);
        if (!redisConnection) {
          throw new Error("CONNECTION_FAILED");
        }

        if (shouldValidate) {
          await redisConnect(redisConnection);
        }

        await setActiveConnection(connectionId);
        setSelectedRedisDatabase(redisConnection.database ?? 0);
        markConnectionSuccess(connectionId);
        setIsWorkspaceSuspended(false);
        await navigate(config.defaultRoute);
        return true;
      }

      // elasticsearch
      const connection = getConnectionById(connectionId);
      if (!connection) {
        throw new Error("CONNECTION_FAILED");
      }

      if (shouldValidate) {
        await pingEsCluster(connection);
      }

      await setActiveConnection(connectionId);
      if (shouldValidate) {
        await refreshIndices(connection);
      }

      markConnectionSuccess(connectionId);
      setIsWorkspaceSuspended(false);
      await navigate(config.defaultRoute);
      return true;
    } catch (error) {
      logError(error, {
        source: "app.connection.change",
        message: `Failed to activate connection ${connectionId}`,
      });
      await disconnectActiveConnection(connectionId);
      setConnectionStatusById((prev) => ({
        ...prev,
        [connectionId]: "failed",
      }));
      setIsWorkspaceSuspended(true);
      await navigate("/", { replace: true });
      setConnectionActionError(t("connections.connectionFailedSimple"));
      return false;
    } finally {
      setIsConnectionActionPending(false);
    }
  };

  const handleDisconnect = async (connectionId?: string) => {
    const targetConnectionId = connectionId ?? activeConnectionId;
    if (isConnectionActionPending || !targetConnectionId) {
      return;
    }

    setIsConnectionActionPending(true);
    setContextMenu(null);
    const currentProfile = getProfileById(targetConnectionId);
    const engine = (currentProfile?.engine ?? "elasticsearch") as EngineType;
    const config = ENGINE_CONFIG[engine];

    try {
      if (config.needsDisconnect) {
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

      await disconnectActiveConnection(targetConnectionId);
      setIsWorkspaceSuspended(false);
      setConnectionStatusById((prev) => ({
        ...prev,
        [targetConnectionId]: "idle",
      }));

      if (targetConnectionId === activeConnectionId) {
        resetMysqlWorkspace();
        setSelectedRedisDatabase(null);
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
    const activeMysqlConnectionId = getActiveConnectionIdByEngine("mysql");
    if (activeMysqlConnectionId === connectionId && status === "success" && !isWorkspaceSuspended) {
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
    if (activeConnectionId || !isWorkspaceSuspended) {
      return;
    }

    setIsWorkspaceSuspended(false);
  }, [activeConnectionId, isWorkspaceSuspended]);

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
    activeConnectionIdByEngine,
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
