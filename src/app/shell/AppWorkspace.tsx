import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { getEngineFromPath } from "../../lib/routeEngine";
import { EsContentArea } from "../../modules/es/routes/EsContentArea";
import { MysqlContentArea } from "../../modules/mysql/routes/MysqlContentArea";
import { RedisContentArea } from "../../modules/redis/routes/RedisContentArea";
import EsWorkspaceTabs from "../../modules/es/components/EsWorkspaceTabs";
import MysqlWorkspaceTabs from "../../modules/mysql/components/MysqlWorkspaceTabs";
import type { useMysqlSidebarWorkspace } from "../../modules/mysql/hooks/useMysqlSidebarWorkspace";
import RedisWorkspaceTabs from "../../modules/redis/components/RedisWorkspaceTabs";
import AppRoutes from "../routes/AppRoutes";

type MysqlSidebarWorkspaceState = ReturnType<typeof useMysqlSidebarWorkspace>;

interface AppWorkspaceProps {
  mysql: MysqlSidebarWorkspaceState;
}

/** Flex-aware wrapper for ContentArea sections that need to fill remaining space */
const flexVisible: React.CSSProperties = { display: "flex", flex: 1, minHeight: 0 };
const flexHidden: React.CSSProperties = { display: "none" };

export default function AppWorkspace({
  mysql,
}: AppWorkspaceProps) {
  const { t } = useTranslation();
  const location = useLocation();

  const currentEngine = useMemo(() => getEngineFromPath(location.pathname), [location.pathname]);

  return (
    <>
      {currentEngine === "elasticsearch" && (
        <EsWorkspaceTabs
          dataBrowserLabel={t("sidebar.dataBrowser")}
          sqlQueryLabel={t("sidebar.sqlQuery")}
          restConsoleLabel={t("sidebar.restConsole")}
          indexManagerLabel={t("sidebar.indexManager")}
        />
      )}

      {currentEngine === "mysql" && (
        <MysqlWorkspaceTabs
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
      )}

      {currentEngine === "redis" && (
        <RedisWorkspaceTabs
          browserLabel={t("redis.sidebar.browser")}
          consoleLabel={t("redis.sidebar.console")}
        />
      )}

      <section className="mdb-content">
        <AppRoutes />
        <div style={currentEngine === "elasticsearch" ? flexVisible : flexHidden}>
          <EsContentArea />
        </div>
        <div style={currentEngine === "mysql" ? flexVisible : flexHidden}>
          <MysqlContentArea />
        </div>
        <div style={currentEngine === "redis" ? flexVisible : flexHidden}>
          <RedisContentArea />
        </div>
      </section>
    </>
  );
}
