import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useConnectionWorkspace, type EngineType } from "../../hooks/useConnectionWorkspace";
import { useFloatingMenuDismiss } from "../../hooks/useFloatingMenuDismiss";
import WorkspaceChrome from "../../layout/WorkspaceChrome";
import { useMysqlSidebarWorkspace } from "../../modules/mysql/hooks/useMysqlSidebarWorkspace";
import AppOverlays from "./AppOverlays";
import { AppSidebarContent, AppSidebarFooter } from "./AppSidebar";
import AppTopbarStatus from "./AppTopbarStatus";
import AppWorkspace, { canShowWorkspace } from "./AppWorkspace";

interface ConnectionDialogState {
  mode: "add" | "edit" | "copy";
  engine: EngineType;
  profileId?: string;
}

export default function AppShell() {
  const { t } = useTranslation();
  const location = useLocation();
  const connection = useConnectionWorkspace();
  const mysql = useMysqlSidebarWorkspace({
    activeConnectionId: connection.activeConnectionIdByEngine.mysql,
    getProfileById: connection.getProfileById,
    ensureMysqlConnectionReady: connection.ensureMysqlConnectionReady,
    setConnectionActionError: connection.setConnectionActionError,
  });

  const [esExpanded, setEsExpanded] = useState(true);
  const [mysqlExpanded, setMysqlExpanded] = useState(true);
  const [redisExpanded, setRedisExpanded] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(266);
  const [connectionDialog, setConnectionDialog] = useState<ConnectionDialogState | null>(null);

  const openConnectionDialog = async (engine: EngineType, mode: "add" | "edit" | "copy", profileId?: string) => {
    if (mode === "edit") {
      await connection.openConnectionConfig(engine, "edit", profileId);
    }
    setConnectionDialog({ engine, mode, profileId });
  };

  const closeConnectionDialog = () => {
    setConnectionDialog(null);
  };

  useFloatingMenuDismiss(
    Boolean(
      connection.contextMenu ||
      mysql.mysqlDatabaseContextMenu ||
      mysql.mysqlTableContextMenu ||
      mysql.mysqlTabContextMenu
    ),
    () => {
      connection.closeConnectionContextMenu();
      mysql.closeMysqlMenus();
    }
  );

  const workspaceVisible = canShowWorkspace(
    connection.activeConnectionIdByEngine,
    connection.isWorkspaceSuspended,
    location.pathname
  );

  const emptyState = (
    <section className="mdb-content mdb-content-empty">
      <div className="card mdb-empty-state-card">
        <span className="muted">{t("sidebar.notConnected")}</span>
      </div>
    </section>
  );

  return (
    <>
      <WorkspaceChrome
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        sidebarWidth={sidebarWidth}
        onSidebarWidthChange={setSidebarWidth}
        brand={t("sidebar.brand")}
        windowHint={connection.activeProfile ? `${connection.activeEngineLabel} / ${connection.activeProfile.name}` : t("sidebar.notConnected")}
        topbarRight={
          <AppTopbarStatus
            activeEngineLabel={connection.activeEngineLabel}
            activeConnectionStatus={connection.activeConnectionStatus}
            visible={Boolean(connection.activeProfile)}
          />
        }
        sidebarContent={
          <AppSidebarContent
            connection={connection}
            mysql={mysql}
            esExpanded={esExpanded}
            mysqlExpanded={mysqlExpanded}
            redisExpanded={redisExpanded}
            onToggleEs={() => setEsExpanded((prev) => !prev)}
            onToggleMysql={() => setMysqlExpanded((prev) => !prev)}
            onToggleRedis={() => setRedisExpanded((prev) => !prev)}
            openConnectionDialog={openConnectionDialog}
          />
        }
        sidebarFooter={<AppSidebarFooter />}
        workspace={
          <AppWorkspace
            activeEngine={connection.activeEngine}
            mysql={mysql}
          />
        }
        emptyState={emptyState}
        canShowWorkspace={workspaceVisible}
      />

      <AppOverlays
        connection={connection}
        mysql={mysql}
        connectionDialog={connectionDialog}
        closeConnectionDialog={closeConnectionDialog}
        openConnectionDialog={openConnectionDialog}
      />
    </>
  );
}
