import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { type EngineType } from "../../hooks/useConnectionWorkspace";
import EsWorkspaceTabs from "../../modules/es/components/EsWorkspaceTabs";
import MysqlWorkspaceTabs from "../../modules/mysql/components/MysqlWorkspaceTabs";
import type { useMysqlSidebarWorkspace } from "../../modules/mysql/hooks/useMysqlSidebarWorkspace";
import RedisWorkspaceTabs from "../../modules/redis/components/RedisWorkspaceTabs";
import AppRoutes from "../routes/AppRoutes";

type MysqlSidebarWorkspaceState = ReturnType<typeof useMysqlSidebarWorkspace>;

interface AppWorkspaceProps {
  activeEngine: EngineType | null;
  mysql: MysqlSidebarWorkspaceState;
}

export default function AppWorkspace({
  activeEngine,
  mysql,
}: AppWorkspaceProps) {
  const { t } = useTranslation();
  const location = useLocation();

  const isEsWorkspace = activeEngine === "elasticsearch";
  const isMysqlWorkspace = activeEngine === "mysql";
  const isRedisWorkspace = activeEngine === "redis";

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
  _pathname: string
) {
  const hasAnyConnected = Object.values(activeConnectionIdByEngine).some(Boolean);
  return hasAnyConnected && !isWorkspaceSuspended;
}
