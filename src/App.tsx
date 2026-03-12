import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import ErrorLogModal from "./components/ErrorLogModal";
import { useConnectionWorkspace } from "./hooks/useConnectionWorkspace";
import { useFloatingMenuDismiss } from "./hooks/useFloatingMenuDismiss";
import { FloatingMenu, FloatingMenuDivider } from "./layout/FloatingMenu";
import WorkspaceChrome from "./layout/WorkspaceChrome";
import { useErrorLog } from "./lib/errorLog";
import type { ConnectionProfile } from "./lib/types";
import EsSidebarSection from "./modules/es/components/EsSidebarSection";
import EsWorkspaceTabs from "./modules/es/components/EsWorkspaceTabs";
import MysqlSidebarSection from "./modules/mysql/components/MysqlSidebarSection";
import MysqlWorkspaceTabs from "./modules/mysql/components/MysqlWorkspaceTabs";
import { useMysqlSidebarWorkspace } from "./modules/mysql/hooks/useMysqlSidebarWorkspace";
import RedisSidebarSection from "./modules/redis/components/RedisSidebarSection";
import RedisWorkspaceTabs from "./modules/redis/components/RedisWorkspaceTabs";
import { ElasticsearchProvider } from "./state/ElasticsearchContext";
import { MysqlProvider } from "./state/MysqlContext";
import { RedisProvider } from "./state/RedisContext";

const EsDataBrowserPage = lazy(() => import("./modules/es/pages/DataBrowser"));
const EsIndexManagerPage = lazy(() => import("./modules/es/pages/IndexManager"));
const EsRestConsolePage = lazy(() => import("./modules/es/pages/RestConsole"));
const EsSqlQueryPage = lazy(() => import("./modules/es/pages/SqlQuery"));
const MysqlConnectionsPage = lazy(() => import("./modules/mysql/pages/Connections"));
const MysqlSqlQueryPage = lazy(() => import("./modules/mysql/pages/SqlQuery"));
const MysqlTableManagerPage = lazy(() => import("./modules/mysql/pages/TableManager"));
const RedisBrowserPage = lazy(() => import("./modules/redis/pages/Browser"));
const RedisConnectionsPage = lazy(() => import("./modules/redis/pages/Connections"));
const RedisConsolePage = lazy(() => import("./modules/redis/pages/Console"));

function WorkspaceLoadingFallback() {
  return (
    <div className="card mdb-empty-state-card">
      <span className="muted">Loading...</span>
    </div>
  );
}

function App() {
  return (
    <ElasticsearchProvider>
      <MysqlProvider>
        <RedisProvider>
          <AppLayout />
        </RedisProvider>
      </MysqlProvider>
    </ElasticsearchProvider>
  );
}

function AppLayout() {
  const { t, i18n } = useTranslation();
  const { count: errorLogCount } = useErrorLog();
  const location = useLocation();
  const connection = useConnectionWorkspace();
  const mysql = useMysqlSidebarWorkspace({
    activeConnectionId: connection.activeConnectionId,
    getProfileById: connection.getProfileById,
    ensureMysqlConnectionReady: connection.ensureMysqlConnectionReady,
    setConnectionActionError: connection.setConnectionActionError,
  });

  const [esExpanded, setEsExpanded] = useState(true);
  const [mysqlExpanded, setMysqlExpanded] = useState(true);
  const [redisExpanded, setRedisExpanded] = useState(true);
  const [isErrorLogOpen, setIsErrorLogOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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

  const showMysqlConnectionsTab = location.pathname.startsWith("/mysql/connections");
  const showRedisConnectionsTab = location.pathname.startsWith("/redis/connections");
  const showConnectionsTab = showMysqlConnectionsTab || showRedisConnectionsTab;
  const canShowWorkspace = (Boolean(connection.activeConnectionId) && !connection.isWorkspaceSuspended) || showConnectionsTab;
  const isEsWorkspace = connection.activeEngine === "elasticsearch";
  const isMysqlWorkspace = connection.activeEngine === "mysql" || showMysqlConnectionsTab;
  const isRedisWorkspace = connection.activeEngine === "redis" || showRedisConnectionsTab;

  const renderConnectionItem = (profile: ConnectionProfile) => {
    const status = connection.connectionStatusById[profile.id] ?? "idle";

    return (
      <div
        key={profile.id}
        className={`mdb-tree-item mdb-connection-item ${connection.focusedConnectionId === profile.id ? "active" : ""}`}
        onClick={() => {
          connection.setFocusedConnectionId(profile.id);
          if (connection.activeConnectionId === profile.id) {
            if (connection.isWorkspaceSuspended) {
              void connection.handleConnectionChange(profile.id, { forceValidate: false });
            }
            return;
          }

          if (status === "success") {
            void connection.handleConnectionChange(profile.id, { forceValidate: false });
          }
        }}
        onDoubleClick={() => {
          if (connection.activeConnectionId === profile.id) {
            if (connection.isWorkspaceSuspended) {
              void connection.handleConnectionChange(profile.id, { forceValidate: false });
            }
            return;
          }

          if (status !== "success") {
            void connection.handleConnectionChange(profile.id, { forceValidate: true });
          }
        }}
        onContextMenu={(event) => connection.handleConnectionContextMenu(event, profile.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }

          event.preventDefault();
          if (connection.activeConnectionId === profile.id) {
            if (connection.isWorkspaceSuspended) {
              void connection.handleConnectionChange(profile.id, { forceValidate: false });
            }
            return;
          }

          if (status === "success") {
            void connection.handleConnectionChange(profile.id, { forceValidate: false });
          }
        }}
      >
        <span className="mdb-connection-main">
          <span className={`mdb-status-dot status-${status}`} />
          <span className="mdb-connection-name">{profile.name}</span>
        </span>
        {connection.activeConnectionId === profile.id ? (
          <span className="mdb-connection-badge">{t("connections.currentInUse")}</span>
        ) : null}
      </div>
    );
  };

  const topbarRight = (
    <>
      {connection.activeProfile ? (
        <span className={`mdb-window-chip status-${connection.activeConnectionStatus}`}>
          {connection.activeEngineLabel}
        </span>
      ) : null}
    </>
  );

  const sidebarContent = (
    <>
      <div className="mdb-sidebar-title">
        <span>{t("sidebar.connection")}</span>
        <span className="muted">{connection.allProfiles.length}</span>
      </div>

      <EsSidebarSection
        expanded={esExpanded}
        onToggle={() => setEsExpanded((prev) => !prev)}
        emptyText={t("connections.noConnections")}
        createConnectionTitle={t("connections.createConnection")}
        hasConnections={connection.esProfiles.length > 0}
      >
        {connection.esProfiles.map(renderConnectionItem)}
      </EsSidebarSection>

      <MysqlSidebarSection
        expanded={mysqlExpanded}
        profiles={connection.mysqlProfiles}
        activeConnectionId={connection.activeConnectionId}
        databases={mysql.databases}
        expandedDatabase={mysql.expandedDatabase}
        selectedDatabase={mysql.selectedDatabase}
        selectedTable={mysql.selectedTable}
        sidebarExpandedTablesDatabase={mysql.sidebarExpandedTablesDatabase}
        tablesByDb={mysql.tablesByDb}
        tablesLabel={t("mysql.tableManager.tables")}
        emptyText={t("connections.noConnections")}
        noTablesText={t("mysql.data.noTables")}
        createConnectionTitle={t("connections.createConnection")}
        refreshTitle={t("common.refresh")}
        renderConnectionItem={renderConnectionItem}
        onToggle={() => setMysqlExpanded((prev) => !prev)}
        onCreateConnection={() => {
          void connection.openConnectionConfig("mysql", "add");
        }}
        onRefresh={() => {
          void mysql.refreshMysqlDatabases();
        }}
        onSelectDatabase={mysql.handleMysqlSelectDatabase}
        onOpenDatabase={(database) => {
          void mysql.handleMysqlOpenDatabase(database);
        }}
        onDatabaseContextMenu={mysql.handleMysqlDatabaseContextMenu}
        onToggleSidebarTables={(database) => {
          void mysql.handleMysqlToggleSidebarTables(database);
        }}
        onSelectSidebarTable={(database, table) => {
          void mysql.handleMysqlSelectSidebarTable(database, table);
        }}
        onOpenSidebarTable={(database, table) => {
          void mysql.handleMysqlOpenSidebarTable(database, table);
        }}
        onTableContextMenu={mysql.handleMysqlTableContextMenu}
      />

      <RedisSidebarSection
        expanded={redisExpanded}
        onToggle={() => setRedisExpanded((prev) => !prev)}
        onCreateConnection={() => {
          void connection.openConnectionConfig("redis", "add");
        }}
        emptyText={t("connections.noConnections")}
        createConnectionTitle={t("connections.createConnection")}
        hasConnections={connection.redisProfiles.length > 0}
      >
        {connection.redisProfiles.map((profile) => (
          <div key={profile.id}>{renderConnectionItem(profile)}</div>
        ))}
      </RedisSidebarSection>

      {connection.connectionActionError ? (
        <div className="text-danger mdb-sidebar-error">{connection.connectionActionError}</div>
      ) : null}
    </>
  );

  const sidebarFooter = (
    <div style={{ display: "flex", gap: "8px", alignItems: "stretch" }}>
      <button
        className="btn btn-sm btn-ghost"
        onClick={() => {
          void i18n.changeLanguage(i18n.language === "zh" ? "en" : "zh");
        }}
        title={t("app.switchLanguageTitle", {
          language: i18n.language === "zh" ? t("common.english") : t("common.chinese"),
        })}
        style={{ flex: "0 0 auto", minWidth: "40px" }}
      >
        {i18n.language === "zh" ? "EN" : "中"}
      </button>
      <button
        type="button"
        className="mdb-sidebar-footer-button"
        onClick={() => setIsErrorLogOpen(true)}
        title={t("errorLog.open")}
        style={{ flex: 1, minWidth: 0 }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t("errorLog.button")}</span>
        <span className={`mdb-sidebar-footer-badge ${errorLogCount > 0 ? "has-errors" : ""}`}>{errorLogCount}</span>
      </button>
    </div>
  );

  const workspace = (
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
        <Suspense fallback={<WorkspaceLoadingFallback />}>
          <Routes>
            <Route path="/" element={null} />
            <Route path="/data" element={<EsDataBrowserPage />} />
            <Route path="/sql" element={<EsSqlQueryPage />} />
            <Route path="/rest" element={<EsRestConsolePage />} />
            <Route path="/indices" element={<EsIndexManagerPage />} />
            <Route path="/mysql" element={<Navigate to="/mysql/tables" replace />} />
            <Route path="/mysql/connections" element={<MysqlConnectionsPage />} />
            <Route path="/mysql/sql" element={<MysqlSqlQueryPage />} />
            <Route path="/mysql/tables" element={<MysqlTableManagerPage />} />
            <Route path="/mysql/table" element={<MysqlTableManagerPage />} />
            <Route path="/redis" element={<Navigate to="/redis/browser" replace />} />
            <Route path="/redis/browser" element={<RedisBrowserPage />} />
            <Route path="/redis/console" element={<RedisConsolePage />} />
            <Route path="/redis/connections" element={<RedisConnectionsPage />} />
            <Route path="*" element={null} />
          </Routes>
        </Suspense>
      </section>
    </>
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
        brand={t("sidebar.brand")}
        windowHint={connection.activeProfile ? `${connection.activeEngineLabel} / ${connection.activeProfile.name}` : t("sidebar.notConnected")}
        topbarRight={topbarRight}
        sidebarContent={sidebarContent}
        sidebarFooter={sidebarFooter}
        workspace={workspace}
        emptyState={emptyState}
        canShowWorkspace={canShowWorkspace}
      />

      {connection.contextMenu ? (
        <FloatingMenu x={connection.contextMenu.x} y={connection.contextMenu.y} minWidth={128}>
          {connection.activeConnectionId === connection.contextMenu.connectionId ? (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              style={{ width: "100%", justifyContent: "flex-start" }}
              disabled={connection.isConnectionActionPending}
              onClick={() => {
                connection.closeConnectionContextMenu();
                void connection.handleDisconnect();
              }}
            >
              {t("connections.disconnect")}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              style={{ width: "100%", justifyContent: "flex-start" }}
              disabled={connection.isConnectionActionPending}
              onClick={() => {
                const contextMenu = connection.contextMenu;
                if (!contextMenu) {
                  return;
                }

                const status = connection.connectionStatusById[contextMenu.connectionId] ?? "idle";
                connection.closeConnectionContextMenu();
                void connection.handleConnectionChange(contextMenu.connectionId, { forceValidate: status !== "success" });
              }}
            >
              {t("connections.connect")}
            </button>
          )}

          <FloatingMenuDivider />

          {connection.getProfileById(connection.contextMenu.connectionId)?.engine === "mysql" ? (
            <>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                style={{ width: "100%", justifyContent: "flex-start" }}
                onClick={() => {
                  const connectionId = connection.contextMenu?.connectionId;
                  connection.closeConnectionContextMenu();
                  if (connectionId) {
                    void mysql.handleCreateMysqlDatabase(connectionId);
                  }
                }}
              >
                {t("mysql.tableManager.createDatabase")}
              </button>
              <FloatingMenuDivider />
            </>
          ) : null}

          {(() => {
            const profile = connection.getProfileById(connection.contextMenu.connectionId);
            if (profile?.engine !== "mysql" && profile?.engine !== "redis") {
              return null;
            }

            return (
              <>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  style={{ width: "100%", justifyContent: "flex-start" }}
                  onClick={() => {
                    const connectionId = connection.contextMenu?.connectionId;
                    connection.closeConnectionContextMenu();
                    if (connectionId) {
                      void connection.openConnectionConfig(profile.engine === "mysql" ? "mysql" : "redis", "edit", connectionId);
                    }
                  }}
                >
                  {t("common.edit")}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  style={{ width: "100%", justifyContent: "flex-start" }}
                  onClick={() => {
                    const connectionId = connection.contextMenu?.connectionId;
                    connection.closeConnectionContextMenu();
                    if (connectionId) {
                      void connection.openConnectionConfig(profile.engine === "mysql" ? "mysql" : "redis", "copy", connectionId);
                    }
                  }}
                >
                  {t("common.copy")}
                </button>
              </>
            );
          })()}

          <button
            type="button"
            className="btn btn-sm btn-ghost text-danger"
            style={{ width: "100%", justifyContent: "flex-start" }}
            onClick={() => {
              const connectionId = connection.contextMenu?.connectionId;
              if (connectionId) {
                void connection.handleDeleteConnection(connectionId);
              }
            }}
          >
            {t("common.delete")}
          </button>
        </FloatingMenu>
      ) : null}

      {mysql.mysqlDatabaseContextMenu ? (
        <FloatingMenu x={mysql.mysqlDatabaseContextMenu.x} y={mysql.mysqlDatabaseContextMenu.y} minWidth={148}>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{ width: "100%", justifyContent: "flex-start" }}
            onClick={() => {
              void mysql.handleMysqlImportDatabase(mysql.mysqlDatabaseContextMenu!.database);
            }}
          >
            {t("mysql.tableManager.importSql")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{ width: "100%", justifyContent: "flex-start" }}
            onClick={() => {
              void mysql.handleMysqlExportDatabase(mysql.mysqlDatabaseContextMenu!.database, false);
            }}
          >
            {t("mysql.tableManager.exportStructure")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{ width: "100%", justifyContent: "flex-start" }}
            onClick={() => {
              void mysql.handleMysqlExportDatabase(mysql.mysqlDatabaseContextMenu!.database, true);
            }}
          >
            {t("mysql.tableManager.exportStructureAndData")}
          </button>
          <FloatingMenuDivider />
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{ width: "100%", justifyContent: "flex-start" }}
            onClick={async () => {
              const database = mysql.mysqlDatabaseContextMenu?.database;
              mysql.setMysqlDatabaseContextMenu(null);
              if (database) {
                await mysql.handleMysqlOpenDatabase(database);
              }
            }}
          >
            {t("mysql.tableManager.openDatabase")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{ width: "100%", justifyContent: "flex-start" }}
            disabled={mysql.expandedDatabase !== mysql.mysqlDatabaseContextMenu.database}
            onClick={async () => {
              const database = mysql.mysqlDatabaseContextMenu?.database;
              mysql.setMysqlDatabaseContextMenu(null);
              if (database) {
                await mysql.handleMysqlCloseDatabase(database);
              }
            }}
          >
            {t("mysql.tableManager.closeDatabase")}
          </button>
          <FloatingMenuDivider />
          <button
            type="button"
            className="btn btn-sm btn-ghost text-danger"
            style={{ width: "100%", justifyContent: "flex-start" }}
            onClick={() => {
              void mysql.handleDropMysqlDatabase(mysql.mysqlDatabaseContextMenu!.database);
            }}
          >
            {t("mysql.tableManager.dropDatabase")}
          </button>
        </FloatingMenu>
      ) : null}

      {mysql.mysqlTableContextMenu ? (
        <FloatingMenu x={mysql.mysqlTableContextMenu.x} y={mysql.mysqlTableContextMenu.y} minWidth={180}>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{ width: "100%", justifyContent: "flex-start" }}
            onClick={async () => {
              const target = mysql.mysqlTableContextMenu;
              mysql.setMysqlTableContextMenu(null);
              if (target) {
                await mysql.handleMysqlOpenSidebarTable(target.database, target.table);
              }
            }}
          >
            {t("mysql.tableManager.openTable")}
          </button>
          <FloatingMenuDivider />
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{ width: "100%", justifyContent: "flex-start" }}
            onClick={() => {
              void mysql.handleMysqlImportTable(mysql.mysqlTableContextMenu!.database, mysql.mysqlTableContextMenu!.table);
            }}
          >
            {t("mysql.tableManager.importSql")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{ width: "100%", justifyContent: "flex-start" }}
            onClick={() => {
              void mysql.handleMysqlExportTable(mysql.mysqlTableContextMenu!.database, mysql.mysqlTableContextMenu!.table, false);
            }}
          >
            {t("mysql.tableManager.exportStructure")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{ width: "100%", justifyContent: "flex-start" }}
            onClick={() => {
              void mysql.handleMysqlExportTable(mysql.mysqlTableContextMenu!.database, mysql.mysqlTableContextMenu!.table, true);
            }}
          >
            {t("mysql.tableManager.exportStructureAndData")}
          </button>
        </FloatingMenu>
      ) : null}

      {mysql.mysqlTabContextMenu ? (
        <FloatingMenu x={mysql.mysqlTabContextMenu.x} y={mysql.mysqlTabContextMenu.y} minWidth={148}>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{ width: "100%", justifyContent: "flex-start" }}
            onClick={() => {
              void mysql.closeCurrentMysqlTab(mysql.mysqlTabContextMenu!.key);
            }}
          >
            {t("mysql.tableManager.closeCurrentTab")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{ width: "100%", justifyContent: "flex-start" }}
            onClick={() => {
              void mysql.closeOtherMysqlTabs(mysql.mysqlTabContextMenu!.key);
            }}
          >
            {t("mysql.tableManager.closeOtherTabs")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{ width: "100%", justifyContent: "flex-start" }}
            onClick={() => {
              void mysql.closeAllMysqlTabs();
            }}
          >
            {t("mysql.tableManager.closeAllTabs")}
          </button>
        </FloatingMenu>
      ) : null}

      {isErrorLogOpen ? <ErrorLogModal open={isErrorLogOpen} onClose={() => setIsErrorLogOpen(false)} /> : null}
    </>
  );
}

export default App;