import { useTranslation } from "react-i18next";
import type { useConnectionWorkspace } from "../../hooks/useConnectionWorkspace";
import type { ConnectionProfile, EngineType } from "../../lib/types";
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
}: AppSidebarContentProps) {
  const { t } = useTranslation();

  const isConnectionFocused = (profile: ConnectionProfile) =>
    connection.focusedConnectionIdByEngine[profile.engine ?? "elasticsearch"] === profile.id;

  const isConnectionActive = (profile: ConnectionProfile) =>
    connection.activeConnectionIdsByEngine[profile.engine ?? "elasticsearch"]?.includes(profile.id) ?? false;

  const renderConnectionItem = (profile: ConnectionProfile) => {
    const status = connection.connectionStatusById[profile.id] ?? "idle";

    const handleActivateConnection = () => {
      connection.setFocusedConnectionId(profile.id);
      if (isConnectionActive(profile)) {
        // Already connected -- just focus (backend stays alive)
        if (connection.isWorkspaceSuspended) {
          void connection.handleConnectionChange(profile.id, { forceValidate: false });
        }
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
        </span>
        {isConnectionFocused(profile) ? (
          <span className="mdb-connection-badge">{t("connections.currentInUse")}</span>
        ) : isConnectionActive(profile) ? (
          <span className="mdb-connection-badge mdb-connection-badge-active">{t("connections.connected")}</span>
        ) : null}
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
