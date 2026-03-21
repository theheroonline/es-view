import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { logError } from "../lib/errorLog";
import type { ConnectionProfile } from "../lib/types";
import { pingCluster } from "../modules/es/services/client";
import { mysqlConnect, mysqlDisconnect, mysqlListDatabases } from "../modules/mysql/services/client";
import { redisConnect, redisDisconnect, redisListDatabases } from "../modules/redis/services/client";
import { useElasticsearchContext } from "../state/ElasticsearchContext";
import { useMysqlContext } from "../state/MysqlContext";
import { useRedisContext } from "../state/RedisContext";

export type ConnectionStatus = "success" | "idle" | "failed";

interface ConnectionContextMenuState {
  connectionId: string;
  x: number;
  y: number;
}

export function useConnectionWorkspace() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    state,
    activeConnectionId,
    activeConnectionIdByEngine,
    getActiveConnectionIdByEngine,
    setActiveConnection,
    refreshIndices,
    disconnectActiveConnection,
    deleteConnection,
    getConnectionById,
  } = useElasticsearchContext();
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
    setDatabases: setRedisDatabases,
    setSelectedDatabase: setSelectedRedisDatabase,
    setScannedKeys: setRedisScannedKeys,
    setNextCursor: setRedisNextCursor,
    setHasMoreKeys: setRedisHasMoreKeys,
    setSelectedKey: setRedisSelectedKey,
    setSelectedKeyDetail: setRedisSelectedKeyDetail,
    getRedisConnectionById,
    resetRedisWorkspace,
  } = useRedisContext();

  const esProfiles = useMemo(
    () => state.profiles.filter((item) => (item.engine ?? "elasticsearch") === "elasticsearch"),
    [state.profiles]
  );
  const mysqlProfiles = useMemo(
    () => state.profiles.filter((item) => item.engine === "mysql"),
    [state.profiles]
  );
  const redisProfiles = useMemo(
    () => state.profiles.filter((item) => item.engine === "redis"),
    [state.profiles]
  );
  const allProfiles = useMemo(
    () => [...esProfiles, ...mysqlProfiles, ...redisProfiles],
    [esProfiles, mysqlProfiles, redisProfiles]
  );

  const activeProfile = activeConnectionId
    ? state.profiles.find((profile) => profile.id === activeConnectionId) ?? null
    : null;
  const activeEngine = activeProfile?.engine ?? "elasticsearch";

  const [focusedConnectionId, setFocusedConnectionId] = useState<string | undefined>(undefined);
  const [contextMenu, setContextMenu] = useState<ConnectionContextMenuState | null>(null);
  const [isConnectionActionPending, setIsConnectionActionPending] = useState(false);
  const [connectionActionError, setConnectionActionError] = useState("");
  const [connectionStatusById, setConnectionStatusById] = useState<Record<string, ConnectionStatus>>({});
  const [isWorkspaceSuspended, setIsWorkspaceSuspended] = useState(false);

  const activeConnectionStatus = activeConnectionId ? connectionStatusById[activeConnectionId] ?? "idle" : "idle";
  const activeEngineLabel = activeEngine === "mysql" ? "MySQL" : activeEngine === "redis" ? "Redis" : "Elasticsearch";

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

      return state.profiles.find((profile) => profile.id === connectionId) ?? null;
    },
    [state.profiles]
  );

  const disconnectConnectionForEdit = async (connectionId?: string) => {
    if (!connectionId) {
      return;
    }

    const currentProfile = getProfileById(connectionId);
    if ((connectionStatusById[connectionId] ?? "idle") === "success" && currentProfile?.engine === "mysql") {
      try {
        await mysqlDisconnect(connectionId);
      } catch (error) {
        logError(error, {
          source: "app.connection.mysql.disconnectBeforeEdit",
          message: `Failed to disconnect MySQL connection ${connectionId} before editing config`,
        });
      }
    }

    if ((connectionStatusById[connectionId] ?? "idle") === "success" && currentProfile?.engine === "redis") {
      try {
        await redisDisconnect(connectionId);
      } catch (error) {
        logError(error, {
          source: "app.connection.redis.disconnectBeforeEdit",
          message: `Failed to disconnect Redis connection ${connectionId} before editing config`,
        });
      }
    }

    await disconnectActiveConnection(connectionId);
    setIsWorkspaceSuspended(false);
    if (connectionId === activeConnectionId) {
      resetMysqlWorkspace();
      resetRedisWorkspace();
    }
    setConnectionStatusById((prev) => ({
      ...prev,
      [connectionId]: "idle",
    }));
  };

  const openConnectionConfig = async (
    engine: "mysql" | "redis",
    action: "add" | "edit" | "copy",
    connectionId?: string
  ) => {
    if (action === "edit") {
      await disconnectConnectionForEdit(connectionId);
    }

    const params = new URLSearchParams({ action });
    if (connectionId) {
      params.set("id", connectionId);
    }

    const basePath = engine === "mysql" ? "/mysql/connections" : "/redis/connections";
    navigate(`${basePath}?${params.toString()}`, {
      state: { from: location.pathname },
    });
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
        const targetRoute = profile?.engine === "mysql"
          ? "/mysql/tables"
          : profile?.engine === "redis"
            ? "/redis/browser"
            : "/data";
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

    try {
      const currentStatus = connectionStatusById[connectionId] ?? "idle";
      const shouldValidate = options?.forceValidate ?? currentStatus !== "success";

      if (profile.engine === "mysql") {
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
        await navigate("/mysql/tables");
        return true;
      }

      if (profile.engine === "redis") {
        const redisConnection = getRedisConnectionById(connectionId);
        if (!redisConnection) {
          throw new Error("CONNECTION_FAILED");
        }

        if (shouldValidate) {
          await redisConnect(redisConnection);
        }

        await setActiveConnection(connectionId);
        resetRedisWorkspace();
        try {
          const databases = await redisListDatabases(connectionId);
          setRedisDatabases(databases);
        } catch (error) {
          logError(error, {
            source: "app.connection.redis.listDatabases",
            message: "Failed to load Redis databases after switching connection",
          });
          setRedisDatabases([]);
        }

        setSelectedRedisDatabase(redisConnection.database ?? 0);
        setRedisScannedKeys([]);
        setRedisNextCursor("0");
        setRedisHasMoreKeys(false);
        setRedisSelectedKey(null);
        setRedisSelectedKeyDetail(null);
        markConnectionSuccess(connectionId);
        setIsWorkspaceSuspended(false);
        await navigate("/redis/browser");
        return true;
      }

      const connection = getConnectionById(connectionId);
      if (!connection) {
        throw new Error("CONNECTION_FAILED");
      }

      if (shouldValidate) {
        await pingCluster(connection);
      }

      await setActiveConnection(connectionId);
      if (shouldValidate) {
        await refreshIndices(connection);
      }

      markConnectionSuccess(connectionId);
      setIsWorkspaceSuspended(false);
      await navigate("/data");
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

    try {
      if (currentProfile?.engine === "mysql") {
        try {
          await mysqlDisconnect(targetConnectionId);
        } catch (error) {
          logError(error, {
            source: "app.connection.mysql.disconnect",
            message: `Failed to disconnect MySQL connection ${targetConnectionId}`,
          });
        }
      }

      if (currentProfile?.engine === "redis") {
        try {
          await redisDisconnect(targetConnectionId);
        } catch (error) {
          logError(error, {
            source: "app.connection.redis.disconnect",
            message: `Failed to disconnect Redis connection ${targetConnectionId}`,
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
        resetRedisWorkspace();
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
    state,
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