import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { getEngineFromPath } from "../../lib/routeEngine";
import EsWorkspaceTabs from "../../modules/es/components/EsWorkspaceTabs";
import MysqlWorkspaceTabs from "../../modules/mysql/components/MysqlWorkspaceTabs";
import type { useMysqlSidebarWorkspace } from "../../modules/mysql/hooks/useMysqlSidebarWorkspace";
import RedisWorkspaceTabs from "../../modules/redis/components/RedisWorkspaceTabs";
import AppRoutes from "../routes/AppRoutes";

type MysqlSidebarWorkspaceState = ReturnType<typeof useMysqlSidebarWorkspace>;

interface AppWorkspaceProps {
  mysql: MysqlSidebarWorkspaceState;
}

export default function AppWorkspace({
  mysql,
}: AppWorkspaceProps) {
  const { t } = useTranslation();
  const location = useLocation();

  const currentEngine = useMemo(() => getEngineFromPath(location.pathname), [location.pathname]);

  const isEsWorkspace = currentEngine === "elasticsearch";
  const isMysqlWorkspace = currentEngine === "mysql";
  const isRedisWorkspace = currentEngine === "redis";

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
