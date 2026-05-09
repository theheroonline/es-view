import type { useConnectionWorkspace } from "../../hooks/useConnectionWorkspace";
import type { EngineType } from "../../lib/types";
import type { useMysqlSidebarWorkspace } from "../../modules/mysql/hooks/useMysqlSidebarWorkspace";
import ConnectionOverlays from "./ConnectionOverlays";
import MysqlOverlays from "../../modules/mysql/features/table-manager/components/MysqlOverlays";

type ConnectionWorkspaceState = ReturnType<typeof useConnectionWorkspace>;
type MysqlSidebarWorkspaceState = ReturnType<typeof useMysqlSidebarWorkspace>;

interface ConnectionDialogState {
  mode: "add" | "edit" | "copy";
  engine: EngineType;
  profileId?: string;
}

interface AppOverlaysProps {
  connection: ConnectionWorkspaceState;
  mysql: MysqlSidebarWorkspaceState;
  connectionDialog: ConnectionDialogState | null;
  closeConnectionDialog: () => void;
  openConnectionDialog: (engine: EngineType, mode: "add" | "edit" | "copy", profileId?: string) => void;
}

export default function AppOverlays({ connection, mysql, connectionDialog, closeConnectionDialog, openConnectionDialog }: AppOverlaysProps) {
  return (
    <>
      <ConnectionOverlays
        connection={connection}
        connectionDialog={connectionDialog}
        closeConnectionDialog={closeConnectionDialog}
        openConnectionDialog={openConnectionDialog}
        onCreateDatabase={mysql.handleCreateMysqlDatabase}
      />
      <MysqlOverlays mysql={mysql} />
    </>
  );
}
