import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import EsWorkspaceTabs from "../../modules/es/components/EsWorkspaceTabs";
import MysqlWorkspaceTabs from "../../modules/mysql/components/MysqlWorkspaceTabs";
import type { useMysqlSidebarWorkspace } from "../../modules/mysql/hooks/useMysqlSidebarWorkspace";
import RedisWorkspaceTabs from "../../modules/redis/components/RedisWorkspaceTabs";
import AppRoutes from "../routes/AppRoutes";

type MysqlSidebarWorkspaceState = ReturnType<typeof useMysqlSidebarWorkspace>;

interface AppWorkspaceProps {
  activeEngine: string;
  mysql: MysqlSidebarWorkspaceState;
}

export default function AppWorkspace({
  activeEngine,
  mysql,
}: AppWorkspaceProps) {
  const { t } = useTranslation();
  const location = useLocation();

  const showMysqlConnectionsTab = location.pathname.startsWith("/mysql/connections");
  const showRedisConnectionsTab = location.pathname.startsWith("/redis/connections");
  const isEsWorkspace = activeEngine === "elasticsearch";
  const isMysqlWorkspace = activeEngine === "mysql" || showMysqlConnectionsTab;
  const isRedisWorkspace = activeEngine === "redis" || showRedisConnectionsTab;

  return (
    <>
      <EsWorkspaceTabs
        visible={isEsWorkspace}
        dataBrowserLabel={t("sidebar.dataBrowser")}
        sqlQueryLabel={t("sidebar.sqlQuery")}
        restConsoleLabel={t("sidebar.restConsole")}
        indexManagerLabel={t("sidebar.indexManager")}
      />

      <MysqlWorkspaceTabs
        visible={isMysqlWorkspace}
        openedTables={mysql.openedTables}
        activeOpenedTableKey={mysql.activeOpenedTableKey}
        locationPathname={location.pathname}
        tableManagerLabel={t("mysql.sidebar.tableManager")}
        sqlQueryLabel={t("mysql.sidebar.sqlQuery")}
        connectionsLabel={t("sidebar.connections")}
        showConnectionsTab={showMysqlConnectionsTab}
        onActivateTable={(database, table) => {
          void mysql.handleActivateMysqlOpenedTable(database, table);
        }}
        onCloseTable={(database, table) => {
          void mysql.handleCloseMysqlOpenedTable(database, table);
        }}
        onTableContextMenu={mysql.handleMysqlTabContextMenu}
      />

      <RedisWorkspaceTabs
        visible={isRedisWorkspace}
        browserLabel={t("redis.sidebar.browser")}
        consoleLabel={t("redis.sidebar.console")}
        connectionsLabel={t("sidebar.connections")}
        showConnectionsTab={showRedisConnectionsTab}
      />

      <section className="mdb-content">
        <AppRoutes />
      </section>
    </>
  );
}

export function canShowWorkspace(
  activeConnectionIdByEngine: Partial<Record<"elasticsearch" | "mysql" | "redis", string>>,
  isWorkspaceSuspended: boolean,
  pathname: string
) {
  const showConnectionsTab = pathname.startsWith("/mysql/connections") || pathname.startsWith("/redis/connections");
  const hasAnyConnected = Object.values(activeConnectionIdByEngine).some(Boolean);
  return (hasAnyConnected && !isWorkspaceSuspended) || showConnectionsTab;
}