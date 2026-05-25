import { useTranslation } from "react-i18next";
import type { useConnectionWorkspace } from "../../hooks/useConnectionWorkspace";
import type { ConnectionProfile, EngineType } from "../../lib/types";
import { useElasticsearchContext } from "../../state/ElasticsearchContext";
import EsSidebarSection from "../../modules/es/components/EsSidebarSection";
import MysqlSidebarSection from "../../modules/mysql/components/MysqlSidebarSection";
import type { useMysqlSidebarWorkspace } from "../../modules/mysql/hooks/useMysqlSidebarWorkspace";
import RedisSidebarSection from "../../modules/redis/components/RedisSidebarSection";

type ConnectionWorkspaceState = ReturnType<typeof useConnectionWorkspace>;
type MysqlSidebarWorkspaceState = ReturnType<typeof useMysqlSidebarWorkspace>;

interface AppSidebarContentProps {
  connection: ConnectionWorkspaceState;
  mysql: MysqlSidebarWorkspaceState;
  esExpanded: boolean;
  mysqlExpanded: boolean;
  redisExpanded: boolean;
  onToggleEs: () => void;
  onToggleMysql: () => void;
  onToggleRedis: () => void;
  openConnectionDialog: (engine: EngineType, mode: "add" | "edit" | "copy", profileId?: string) => void;
  onNavigateToEngineDefaultRoute: (engine: string) => void;
}

export function AppSidebarContent({
  connection,
  mysql,
  esExpanded,
  mysqlExpanded,
  redisExpanded,
  onToggleEs,
  onToggleMysql,
  onToggleRedis,
  openConnectionDialog,
  onNavigateToEngineDefaultRoute,
}: AppSidebarContentProps) {
  const { t } = useTranslation();
  const { esVersion } = useElasticsearchContext();

  const isConnectionFocused = (profile: ConnectionProfile) =>
    connection.focusedConnectionIdByEngine[profile.engine ?? "elasticsearch"] === profile.id;

  const isConnectionActive = (profile: ConnectionProfile) =>
    connection.activeConnectionIdsByEngine[profile.engine ?? "elasticsearch"]?.includes(profile.id) ?? false;

  const renderConnectionItem = (profile: ConnectionProfile) => {
    const status = connection.connectionStatusById[profile.id] ?? "idle";

    const handleActivateConnection = async () => {
      const engine = profile.engine ?? "elasticsearch";
      const wasAlreadyFocused = connection.focusedConnectionIdByEngine[engine] === profile.id;

      // 使用 pendingConnectionRef 做实时检查，避免 React 状态更新异步导致的去重失效
      if (connection.pendingConnectionRef.current.has(profile.id)) {
        return;
      }

      connection.setFocusedConnectionId(profile.id);

      // If status is "failed", treat as a reconnect attempt
      if (status === "failed") {
        void connection.handleConnectionChange(profile.id, { forceValidate: true });
        return;
      }

      if (isConnectionActive(profile)) {
        if (wasAlreadyFocused) {
          // Scenario A early-returns without navigating -- switch to the engine's default route here
          onNavigateToEngineDefaultRoute(engine);
          return;
        }

        // Scenario B: handleConnectionChange will handle the navigation
        void connection.handleConnectionChange(profile.id, { forceValidate: false });
        return;
      }

      // Not yet connected -- full connect flow
      void connection.handleConnectionChange(profile.id, { forceValidate: status !== "success" });
    };

    return (
      <div
        key={profile.id}
        className={`mdb-tree-item mdb-connection-item ${connection.focusedConnectionId === profile.id ? "active" : ""}`}
        onClick={handleActivateConnection}
        onDoubleClick={handleActivateConnection}
        onContextMenu={(event) => connection.handleConnectionContextMenu(event, profile.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }

          event.preventDefault();
          handleActivateConnection();
        }}
      >
        <span className="mdb-connection-main">
          <span className={`mdb-status-dot status-${status}`} />
          <span className="mdb-connection-name">{profile.name}</span>
          {esVersion && profile.engine === "elasticsearch" && (
            <span className="mdb-connection-version">v{esVersion.number}</span>
          )}
          {profile.connectionType === "production" && (
            <span className="mdb-connection-type mdb-connection-type-prod" title="Production">PROD</span>
          )}
          {profile.connectionType === "test" && (
            <span className="mdb-connection-type mdb-connection-type-test" title="Test">TEST</span>
          )}
          {profile.connectionType === "development" && (
            <span className="mdb-connection-type mdb-connection-type-dev" title="Development">DEV</span>
          )}
        </span>
        {status === "failed" && (
          <span className="mdb-connection-badge mdb-connection-badge-failed" style={{ cursor: "pointer" }} title={t("connections.reconnect")}>
            {t("connections.reconnectHint")}
          </span>
        )}
        {status !== "failed" && (
          isConnectionFocused(profile) ? (
            <span className="mdb-connection-badge">{t("connections.currentInUse")}</span>
          ) : isConnectionActive(profile) ? (
            <span className="mdb-connection-badge mdb-connection-badge-active">{t("connections.connected")}</span>
          ) : null
        )}
      </div>
    );
  };

  return (
    <>
      <div className="mdb-sidebar-title">
        <span>{t("sidebar.connection")}</span>
        <span className="muted">{connection.allProfiles.length}</span>
      </div>

      <EsSidebarSection
        expanded={esExpanded}
        onToggle={onToggleEs}
        label={t("sidebar.engineNames.elasticsearch")}
        onCreateConnection={() => {
          openConnectionDialog("elasticsearch", "add");
        }}
        emptyText={t("connections.noConnections")}
        createConnectionTitle={t("connections.createConnection")}
        hasConnections={connection.esProfiles.length > 0}
      >
        {connection.esProfiles.map(renderConnectionItem)}
      </EsSidebarSection>

      <MysqlSidebarSection
        expanded={mysqlExpanded}
        profiles={connection.mysqlProfiles}
        activeConnectionId={connection.activeConnectionIdByEngine.mysql}
        databases={mysql.databases}
        expandedSidebarTablesDatabases={mysql.sidebarExpandedTablesDatabases}
        selectedSidebarTables={mysql.selectedSidebarTables}
        selectedDatabase={mysql.selectedDatabase}
        selectedTable={mysql.selectedTable}
        tablesByDb={mysql.tablesByDb}
        emptyText={t("connections.noConnections")}
        noTablesText={t("mysql.data.noTables")}
        createConnectionTitle={t("connections.createConnection")}
        renderConnectionItem={renderConnectionItem}
        onToggle={onToggleMysql}
        onCreateConnection={() => {
          openConnectionDialog("mysql", "add");
        }}
        onOpenDatabase={(database) => {
          void mysql.handleMysqlOpenDatabase(database);
        }}
        onDatabaseContextMenu={mysql.handleMysqlDatabaseContextMenu}
        onToggleSidebarTables={(database) => {
          void mysql.handleMysqlToggleSidebarTables(database);
        }}
        onSelectSidebarTable={(event, database, table) => {
          void mysql.handleMysqlSelectSidebarTable(event, database, table);
        }}
        onOpenSidebarTable={(database, table) => {
          void mysql.handleMysqlOpenSidebarTable(database, table);
        }}
        onTableContextMenu={mysql.handleMysqlTableContextMenu}
        onSidebarTableDragStart={mysql.handleSidebarTableDragStart}
        onSidebarDatabaseDrop={mysql.handleSidebarDatabaseDrop}
      />

      <RedisSidebarSection
        expanded={redisExpanded}
        onToggle={onToggleRedis}
        onCreateConnection={() => {
          openConnectionDialog("redis", "add");
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
}

export function AppSidebarFooter() {
  const { t, i18n } = useTranslation();

  return (
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
    </div>
  );
}
