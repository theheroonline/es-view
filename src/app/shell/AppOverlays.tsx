import { useTranslation } from "react-i18next";
import type { useConnectionWorkspace } from "../../hooks/useConnectionWorkspace";
import { FloatingMenu, FloatingMenuDivider } from "../../layout/FloatingMenu";
import { getCharsetOption, MYSQL_CHARSET_OPTIONS } from "../../modules/mysql/constants/databaseOptions";
import type { useMysqlSidebarWorkspace } from "../../modules/mysql/hooks/useMysqlSidebarWorkspace";

type ConnectionWorkspaceState = ReturnType<typeof useConnectionWorkspace>;
type MysqlSidebarWorkspaceState = ReturnType<typeof useMysqlSidebarWorkspace>;

const menuButtonStyle = { width: "100%", justifyContent: "flex-start" } as const;

interface AppOverlaysProps {
  connection: ConnectionWorkspaceState;
  mysql: MysqlSidebarWorkspaceState;
}

export default function AppOverlays({ connection, mysql }: AppOverlaysProps) {
  const { t } = useTranslation();
  const connectionMenu = connection.contextMenu;
  const mysqlDatabaseMenu = mysql.mysqlDatabaseContextMenu;
  const mysqlTableMenu = mysql.mysqlTableContextMenu;
  const mysqlTabMenu = mysql.mysqlTabContextMenu;
  const createDatabaseDialog = mysql.createDatabaseDialog;
  const tableTransferDialog = mysql.tableTransferDialog;
  const databasePropertiesDialog = mysql.databasePropertiesDialog;
  const dropDatabaseConfirmDialog = mysql.dropDatabaseConfirmDialog;
  const tableTransferTask = mysql.tableTransferTask;

  return (
    <>
      {connectionMenu ? (
        <FloatingMenu x={connectionMenu.x} y={connectionMenu.y} minWidth={128}>
          {(connection.connectionStatusById[connectionMenu.connectionId] ?? "idle") === "success" ? (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              style={menuButtonStyle}
              disabled={connection.isConnectionActionPending}
              onClick={() => {
                connection.closeConnectionContextMenu();
                void connection.handleDisconnect(connectionMenu.connectionId);
              }}
            >
              {t("connections.disconnect")}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              style={menuButtonStyle}
              disabled={connection.isConnectionActionPending}
              onClick={() => {
                const profile = connection.getProfileById(connectionMenu.connectionId);
                const status = connection.connectionStatusById[connectionMenu.connectionId] ?? "idle";
                connection.closeConnectionContextMenu();
                if (!profile) {
                  return;
                }
                void connection.handleConnectionChange(connectionMenu.connectionId, { forceValidate: status !== "success" });
              }}
            >
              {t("connections.connect")}
            </button>
          )}

          <FloatingMenuDivider />

          {connection.getProfileById(connectionMenu.connectionId)?.engine === "mysql" ? (
            <>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                style={menuButtonStyle}
                onClick={() => {
                  connection.closeConnectionContextMenu();
                  void mysql.handleCreateMysqlDatabase(connectionMenu.connectionId);
                }}
              >
                {t("mysql.tableManager.createDatabase")}
              </button>
              <FloatingMenuDivider />
            </>
          ) : null}

          {(() => {
            const profile = connection.getProfileById(connectionMenu.connectionId);
            if (profile?.engine !== "mysql" && profile?.engine !== "redis") {
              return null;
            }

            const targetEngine = profile.engine === "mysql" ? "mysql" : "redis";

            return (
              <>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  style={menuButtonStyle}
                  onClick={() => {
                    connection.closeConnectionContextMenu();
                    void connection.openConnectionConfig(targetEngine, "edit", connectionMenu.connectionId);
                  }}
                >
                  {t("common.edit")}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  style={menuButtonStyle}
                  onClick={() => {
                    connection.closeConnectionContextMenu();
                    void connection.openConnectionConfig(targetEngine, "copy", connectionMenu.connectionId);
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
            style={menuButtonStyle}
            onClick={() => {
              void connection.handleDeleteConnection(connectionMenu.connectionId);
            }}
          >
            {t("common.delete")}
          </button>
        </FloatingMenu>
      ) : null}

      {mysqlDatabaseMenu ? (
        <FloatingMenu x={mysqlDatabaseMenu.x} y={mysqlDatabaseMenu.y} minWidth={148}>
          {mysql.expandedSidebarDatabases.includes(mysqlDatabaseMenu.database) ? (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              style={menuButtonStyle}
              onClick={async () => {
                mysql.setMysqlDatabaseContextMenu(null);
                await mysql.handleMysqlCloseDatabase(mysqlDatabaseMenu.database);
              }}
            >
              {t("mysql.tableManager.closeDatabase")}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              style={menuButtonStyle}
              onClick={async () => {
                mysql.setMysqlDatabaseContextMenu(null);
                await mysql.handleMysqlOpenDatabase(mysqlDatabaseMenu.database);
              }}
            >
              {t("mysql.tableManager.openDatabase")}
            </button>
          )}
          <FloatingMenuDivider />
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={menuButtonStyle}
            onClick={() => {
              mysql.handleMysqlCreateTable(mysqlDatabaseMenu.database);
            }}
          >
            {t("mysql.tableManager.createTable")}
          </button>
          <FloatingMenuDivider />
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={menuButtonStyle}
            onClick={() => {
              void mysql.handleMysqlImportDatabase(mysqlDatabaseMenu.database);
            }}
          >
            {t("mysql.tableManager.importSql")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={menuButtonStyle}
            onClick={() => {
              void mysql.handleMysqlExportDatabase(mysqlDatabaseMenu.database, false);
            }}
          >
            {t("mysql.tableManager.exportStructure")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={menuButtonStyle}
            onClick={() => {
              void mysql.handleMysqlExportDatabase(mysqlDatabaseMenu.database, true);
            }}
          >
            {t("mysql.tableManager.exportStructureAndData")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={menuButtonStyle}
            onClick={() => {
              mysql.handleViewDatabaseProperties(mysqlDatabaseMenu.database);
            }}
          >
            {t("mysql.tableManager.viewDatabaseProperties")}
          </button>
          <FloatingMenuDivider />
          <button
            type="button"
            className="btn btn-sm btn-ghost text-danger"
            style={menuButtonStyle}
            onClick={() => {
              void mysql.handleDropMysqlDatabase(mysqlDatabaseMenu.database);
            }}
          >
            {t("mysql.tableManager.dropDatabase")}
          </button>
        </FloatingMenu>
      ) : null}

      {mysqlTableMenu ? (
        <FloatingMenu x={mysqlTableMenu.x} y={mysqlTableMenu.y} minWidth={180}>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={menuButtonStyle}
            onClick={async () => {
              mysql.setMysqlTableContextMenu(null);
              await mysql.handleMysqlOpenSidebarTable(mysqlTableMenu.database, mysqlTableMenu.table);
            }}
          >
            {t("mysql.tableManager.openTable")}
          </button>
          <FloatingMenuDivider />
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={menuButtonStyle}
            onClick={() => {
              void mysql.handleMysqlImportTable(mysqlTableMenu.database, mysqlTableMenu.table);
            }}
          >
            {t("mysql.tableManager.importSql")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={menuButtonStyle}
            onClick={() => {
              void mysql.handleMysqlExportTable(mysqlTableMenu.database, mysqlTableMenu.table, false);
            }}
          >
            {t("mysql.tableManager.exportStructure")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={menuButtonStyle}
            onClick={() => {
              void mysql.handleMysqlExportTable(mysqlTableMenu.database, mysqlTableMenu.table, true);
            }}
          >
            {t("mysql.tableManager.exportStructureAndData")}
          </button>
        </FloatingMenu>
      ) : null}

      {mysqlTabMenu ? (
        <FloatingMenu x={mysqlTabMenu.x} y={mysqlTabMenu.y} minWidth={148}>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={menuButtonStyle}
            onClick={() => {
              void mysql.closeCurrentMysqlTab(mysqlTabMenu.key);
            }}
          >
            {t("mysql.tableManager.closeCurrentTab")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={menuButtonStyle}
            onClick={() => {
              void mysql.closeOtherMysqlTabs(mysqlTabMenu.key);
            }}
          >
            {t("mysql.tableManager.closeOtherTabs")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={menuButtonStyle}
            onClick={() => {
              void mysql.closeAllMysqlTabs();
            }}
          >
            {t("mysql.tableManager.closeAllTabs")}
          </button>
        </FloatingMenu>
      ) : null}

      {createDatabaseDialog ? (
        <div className="modal-overlay" onClick={() => mysql.setCreateDatabaseDialog(null)}>
          <div className="card modal-card modal-card-md modal-card-scroll" onClick={(event) => event.stopPropagation()}>
            <div className="card-header page-section-header">
              <h3 className="card-title">{t("mysql.tableManager.createDatabaseDialog")}</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => mysql.setCreateDatabaseDialog(null)}>
                {t("common.close")}
              </button>
            </div>
            <div className="modal-card-body modal-card-grid">
              <div>
                <label>{t("mysql.tableManager.databaseName")}</label>
                <input
                  className="form-control"
                  value={createDatabaseDialog.name}
                  onChange={(event) =>
                    mysql.setCreateDatabaseDialog((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                  }
                  autoFocus
                />
              </div>
              <div>
                <label>{t("mysql.tableManager.databaseCharset")}</label>
                <select
                  className="form-control"
                  value={createDatabaseDialog.charset}
                  onChange={(event) => {
                    const nextCharset = event.target.value;
                    const nextOption = getCharsetOption(nextCharset);
                    mysql.setCreateDatabaseDialog((prev) => (
                      prev
                        ? {
                            ...prev,
                            charset: nextCharset,
                            collation: nextOption.defaultCollation,
                          }
                        : prev
                    ));
                  }}
                >
                  {MYSQL_CHARSET_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>{t("mysql.tableManager.databaseCollation")}</label>
                <select
                  className="form-control"
                  value={createDatabaseDialog.collation}
                  onChange={(event) =>
                    mysql.setCreateDatabaseDialog((prev) => (prev ? { ...prev, collation: event.target.value } : prev))
                  }
                >
                  {getCharsetOption(createDatabaseDialog.charset).collations.map((collation) => (
                    <option key={collation} value={collation}>
                      {collation}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-card-footer">
              <button className="btn btn-sm btn-ghost" onClick={() => mysql.setCreateDatabaseDialog(null)}>
                {t("common.cancel")}
              </button>
              <button className="btn btn-sm btn-primary" onClick={() => void mysql.handleConfirmCreateMysqlDatabase()}>
                {t("common.save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tableTransferDialog ? (
        <div className="modal-overlay" onClick={() => mysql.setTableTransferDialog(null)}>
          <div className="card modal-card modal-card-sm modal-card-scroll" onClick={(event) => event.stopPropagation()}>
            <div className="card-header page-section-header">
              <h3 className="card-title">{t("mysql.tableManager.dragCopyTable")}</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => mysql.setTableTransferDialog(null)}>
                {t("common.close")}
              </button>
            </div>
            <div className="modal-card-body modal-card-grid">
              <div className="tm-transfer-summary-card">
                {tableTransferDialog.sourceTables.length === 1
                  ? t("mysql.tableManager.dragCopySummary", {
                      table: tableTransferDialog.sourceTables[0],
                      source: tableTransferDialog.sourceDatabase,
                      target: tableTransferDialog.targetDatabase,
                    })
                  : t("mysql.tableManager.dragCopyBatchSummary", {
                      source: tableTransferDialog.sourceDatabase,
                      target: tableTransferDialog.targetDatabase,
                      count: tableTransferDialog.sourceTables.length,
                    })}
              </div>
              <div className="tm-transfer-table-list">
                {tableTransferDialog.sourceTables.map((table) => (
                  <span key={table} className="tm-transfer-table-chip">{table}</span>
                ))}
              </div>
            </div>
            <div className="modal-card-footer" style={{ justifyContent: "space-between" }}>
              <button className="btn btn-sm btn-ghost" onClick={() => mysql.setTableTransferDialog(null)}>
                {t("common.cancel")}
              </button>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="btn btn-sm btn-ghost" onClick={() => void mysql.handleConfirmTableTransfer(false)}>
                  {t("mysql.tableManager.copyStructureOnly")}
                </button>
                <button className="btn btn-sm btn-primary" onClick={() => void mysql.handleConfirmTableTransfer(true)}>
                  {t("mysql.tableManager.copyStructureAndData")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {databasePropertiesDialog ? (
        <div className="modal-overlay" onClick={() => mysql.setDatabasePropertiesDialog(null)}>
          <div className="card modal-card modal-card-md modal-card-scroll" onClick={(event) => event.stopPropagation()}>
            <div className="card-header page-section-header">
              <h3 className="card-title">{t("mysql.tableManager.viewDatabaseProperties")}</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => mysql.setDatabasePropertiesDialog(null)}>
                {t("common.close")}
              </button>
            </div>
            <div className="modal-card-body modal-card-grid">
              <div>
                <label>{t("mysql.tableManager.databaseName")}</label>
                <input className="form-control" value={databasePropertiesDialog.database} disabled />
              </div>
              <div>
                <label>{t("mysql.tableManager.databaseCharset")}</label>
                <select className="form-control" value={databasePropertiesDialog.charset} disabled>
                  {MYSQL_CHARSET_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>{t("mysql.tableManager.databaseCollation")}</label>
                <select className="form-control" value={databasePropertiesDialog.collation} disabled>
                  {getCharsetOption(databasePropertiesDialog.charset).collations.map((collation) => (
                    <option key={collation} value={collation}>
                      {collation}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-card-footer">
              <button className="btn btn-sm btn-primary" onClick={() => mysql.setDatabasePropertiesDialog(null)}>
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {dropDatabaseConfirmDialog ? (
        <div className="modal-overlay" onClick={() => mysql.setDropDatabaseConfirmDialog(null)}>
          <div className="card modal-card modal-card-sm modal-card-scroll" onClick={(event) => event.stopPropagation()}>
            <div className="card-header page-section-header">
              <h3 className="card-title">
                {t("mysql.tableManager.dropDatabaseConfirm", { name: dropDatabaseConfirmDialog.database })}
              </h3>
              <button className="btn btn-sm btn-ghost" onClick={() => mysql.setDropDatabaseConfirmDialog(null)}>
                {t("common.close")}
              </button>
            </div>
            <div className="modal-card-body">
              <p style={{ margin: 0, color: "#ef4444", fontSize: "14px" }}>
                {t("mysql.tableManager.dropDatabaseWarning", { name: dropDatabaseConfirmDialog.database })}
              </p>
            </div>
            <div className="modal-card-footer">
              <button className="btn btn-sm btn-ghost" onClick={() => mysql.setDropDatabaseConfirmDialog(null)}>
                {t("common.cancel")}
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => void mysql.confirmDropMysqlDatabase(dropDatabaseConfirmDialog.database)}
              >
                {t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tableTransferTask ? (
        <div
          className="modal-overlay"
          onClick={() => {
            if (tableTransferTask.status === "completed") {
              mysql.setTableTransferTask(null);
            }
          }}
        >
          <div className="card modal-card modal-card-md modal-card-scroll" onClick={(event) => event.stopPropagation()}>
            <div className="card-header page-section-header">
              <div>
                <h3 className="card-title">{t("mysql.tableManager.dragCopyTable")}</h3>
                <p className="muted tm-modal-note">
                  {tableTransferTask.status === "running"
                    ? t("mysql.tableManager.transferTaskRunning")
                    : t("mysql.tableManager.transferTaskCompleted")}
                </p>
              </div>
              <button
                className="btn btn-sm btn-ghost"
                disabled={tableTransferTask.status !== "completed"}
                onClick={() => mysql.setTableTransferTask(null)}
              >
                {t("common.close")}
              </button>
            </div>
            <div className="modal-card-body modal-card-grid tm-transfer-task-body">
              <div className="tm-transfer-summary-card">
                {t("mysql.tableManager.dragCopyBatchSummary", {
                  source: tableTransferTask.sourceDatabase,
                  target: tableTransferTask.targetDatabase,
                  count: tableTransferTask.sourceTables.length,
                })}
              </div>
              <div className="tm-transfer-progress-card">
                <div className="tm-transfer-progress-row">
                  <strong>
                    {t("mysql.tableManager.transferTaskProgress", {
                      completed: tableTransferTask.items.filter((item) => item.status === "success" || item.status === "error").length,
                      total: tableTransferTask.items.length,
                    })}
                  </strong>
                  <span className="muted">
                    {tableTransferTask.includeData
                      ? t("mysql.tableManager.copyStructureAndData")
                      : t("mysql.tableManager.copyStructureOnly")}
                  </span>
                </div>
                <div className="tm-transfer-progress-track">
                  <div
                    className="tm-transfer-progress-bar"
                    style={{
                      width: `${tableTransferTask.items.length === 0
                        ? 0
                        : (tableTransferTask.items.filter((item) => item.status === "success" || item.status === "error").length / tableTransferTask.items.length) * 100}%`,
                    }}
                  />
                </div>
                <div className="tm-transfer-progress-meta muted">
                  <span>
                    {t("mysql.tableManager.transferTaskSuccessCount", {
                      count: tableTransferTask.items.filter((item) => item.status === "success").length,
                    })}
                  </span>
                  <span>
                    {t("mysql.tableManager.transferTaskFailedCount", {
                      count: tableTransferTask.items.filter((item) => item.status === "error").length,
                    })}
                  </span>
                </div>
              </div>
              <div className="tm-transfer-task-list">
                {tableTransferTask.items.map((item) => (
                  <div key={item.table} className={`tm-transfer-task-item status-${item.status}`}>
                    <div className="tm-transfer-task-item-main">
                      <span className="tm-transfer-table-chip">{item.table}</span>
                      <span className={`tm-transfer-task-status status-${item.status}`}>
                        {item.status === "pending"
                          ? t("mysql.tableManager.transferTaskPending")
                          : item.status === "running"
                            ? t("mysql.tableManager.transferTaskRunningItem")
                            : item.status === "success"
                              ? t("mysql.tableManager.transferTaskSuccess")
                              : t("mysql.tableManager.transferTaskFailed")}
                      </span>
                    </div>
                    {item.error ? <div className="text-danger tm-transfer-task-error">{item.error}</div> : null}
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-card-footer">
              <button
                className="btn btn-sm btn-primary"
                disabled={tableTransferTask.status !== "completed"}
                onClick={() => mysql.setTableTransferTask(null)}
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ERROR LOG MODAL HIDDEN - DO NOT DELETE */}
    </>
  );
}