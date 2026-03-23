import type { MouseEvent } from "react";
import { NavLink } from "react-router-dom";
import type { MysqlOpenedTable } from "../types";
import { getMysqlOpenedTableKey } from "../types";

interface MysqlWorkspaceTabsProps {
  openedTables: MysqlOpenedTable[];
  activeOpenedTableKey: string | null;
  locationPathname: string;
  tableManagerLabel: string;
  sqlQueryLabel: string;
  connectionsLabel: string;
  showConnectionsTab: boolean;
  visible: boolean;
  onActivateTable: (database: string, table: string) => void;
  onCloseTable: (database: string, table: string) => void;
  onTableContextMenu: (event: MouseEvent<HTMLButtonElement>, key: string) => void;
}

export default function MysqlWorkspaceTabs({
  openedTables,
  activeOpenedTableKey,
  locationPathname,
  tableManagerLabel,
  sqlQueryLabel,
  connectionsLabel,
  showConnectionsTab,
  visible,
  onActivateTable,
  onCloseTable,
  onTableContextMenu,
}: MysqlWorkspaceTabsProps) {
  return (
    <div className="mdb-tabs" style={{ display: visible ? "flex" : "none" }}>
      <NavLink to="/mysql/tables" className={({ isActive }) => `mdb-tab ${isActive ? "active" : ""}`}>
        {tableManagerLabel}
      </NavLink>
      {openedTables.map((item) => {
        const tabKey = getMysqlOpenedTableKey(item.database, item.table);
        const isActiveTab = locationPathname === "/mysql/table" && activeOpenedTableKey === tabKey;

        return (
          <button
            key={tabKey}
            type="button"
            className={`mdb-tab mdb-tab-button ${isActiveTab ? "active" : ""}`}
            onClick={() => onActivateTable(item.database, item.table)}
            onContextMenu={(event) => onTableContextMenu(event, tabKey)}
          >
            <span className="mdb-tab-label">{item.database}.{item.table}</span>
            <span
              className="mdb-tab-close"
              onClick={(event) => {
                event.stopPropagation();
                onCloseTable(item.database, item.table);
              }}
            >
              ×
            </span>
          </button>
        );
      })}
      <NavLink to="/mysql/sql" className={({ isActive }) => `mdb-tab ${isActive ? "active" : ""}`}>
        {sqlQueryLabel}
      </NavLink>
      {showConnectionsTab ? (
        <NavLink to="/mysql/connections" className={({ isActive }) => `mdb-tab ${isActive ? "active" : ""}`}>
          {connectionsLabel}
        </NavLink>
      ) : null}
    </div>
  );
}