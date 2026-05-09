import { useTranslation } from "react-i18next";
import type { useConnectionWorkspace } from "../../hooks/useConnectionWorkspace";
import type { EngineType } from "../../lib/types";
import { FloatingMenu, FloatingMenuDivider } from "../../layout/FloatingMenu";
import EsConnectionDialog from "../../modules/es/components/EsConnectionDialog";
import MysqlConnectionDialog from "../../modules/mysql/components/MysqlConnectionDialog";
import RedisConnectionDialog from "../../modules/redis/components/RedisConnectionDialog";

type ConnectionWorkspaceState = ReturnType<typeof useConnectionWorkspace>;

const menuButtonStyle = { width: "100%", justifyContent: "flex-start" } as const;

interface ConnectionDialogState {
  mode: "add" | "edit" | "copy";
  engine: EngineType;
  profileId?: string;
}

interface ConnectionOverlaysProps {
  connection: ConnectionWorkspaceState;
  connectionDialog: ConnectionDialogState | null;
  closeConnectionDialog: () => void;
  openConnectionDialog: (engine: EngineType, mode: "add" | "edit" | "copy", profileId?: string) => void;
  onCreateDatabase?: (connectionId: string) => void;
}

export default function ConnectionOverlays({
  connection,
  connectionDialog,
  closeConnectionDialog,
  openConnectionDialog,
  onCreateDatabase,
}: ConnectionOverlaysProps) {
  const { t } = useTranslation();
  const connectionMenu = connection.contextMenu;

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

          {connection.getProfileById(connectionMenu.connectionId)?.engine === "mysql" && onCreateDatabase ? (
            <>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                style={menuButtonStyle}
                onClick={() => {
                  connection.closeConnectionContextMenu();
                  void onCreateDatabase(connectionMenu.connectionId);
                }}
              >
                {t("mysql.tableManager.createDatabase")}
              </button>
              <FloatingMenuDivider />
            </>
          ) : null}

          {(() => {
            const profile = connection.getProfileById(connectionMenu.connectionId);
            if (!profile) {
              return null;
            }

            const engine = (profile.engine ?? "elasticsearch") as EngineType;

            return (
              <>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  style={menuButtonStyle}
                  onClick={() => {
                    connection.closeConnectionContextMenu();
                    openConnectionDialog(engine, "edit", connectionMenu.connectionId);
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
                    openConnectionDialog(engine, "copy", connectionMenu.connectionId);
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

      {connectionDialog ? (
        connectionDialog.engine === "mysql" ? (
          <MysqlConnectionDialog
            mode={connectionDialog.mode}
            profileId={connectionDialog.profileId}
            onClose={closeConnectionDialog}
            onSuccess={closeConnectionDialog}
          />
        ) : connectionDialog.engine === "redis" ? (
          <RedisConnectionDialog
            mode={connectionDialog.mode}
            profileId={connectionDialog.profileId}
            onClose={closeConnectionDialog}
            onSuccess={closeConnectionDialog}
          />
        ) : (
          <EsConnectionDialog
            mode={connectionDialog.mode}
            profileId={connectionDialog.profileId}
            onClose={closeConnectionDialog}
            onSuccess={closeConnectionDialog}
          />
        )
      ) : null}
    </>
  );
}
