import type { MouseEvent } from "react";
import { NavLink } from "react-router-dom";
import type { MysqlOpenedTable } from "../types";
import { getMysqlOpenedTableTabKey } from "../types";

interface MysqlWorkspaceTabsProps {
  openedTables: MysqlOpenedTable[];
  activeOpenedTableKey: string | null;
  locationPathname: string;
  tableManagerLabel: string;
  sqlQueryLabel: string;
  onActivateTable: (item: MysqlOpenedTable) => void;
  onCloseTable: (database: string, table: string, view: string) => void;
  onTableContextMenu: (event: MouseEvent<HTMLButtonElement>, key: string) => void;
}

export default function MysqlWorkspaceTabs({
  openedTables,
  activeOpenedTableKey,
  locationPathname,
  tableManagerLabel,
  sqlQueryLabel,
  onActivateTable,
  onCloseTable,
  onTableContextMenu,
}: MysqlWorkspaceTabsProps) {
  return (
    <div className="mdb-tabs">
      <NavLink to="/mysql/tables" className={({ isActive }) => `mdb-tab ${isActive ? "active" : ""}`}>
        {tableManagerLabel}
      </NavLink>
      {openedTables.map((item) => {
        const tabKey = getMysqlOpenedTableTabKey(item.database, item.table, item.view);
        const isActiveTab = locationPathname === "/mysql/table" && activeOpenedTableKey === tabKey;

        return (
          <button
            key={tabKey}
            type="button"
            className={`mdb-tab mdb-tab-button ${isActiveTab ? "active" : ""}`}
            onClick={() => onActivateTable(item)}
            onContextMenu={(event) => onTableContextMenu(event, tabKey)}
          >
            <span className="mdb-tab-label">{item.database}.{item.table}</span>
            <span
              className="mdb-tab-close"
              onClick={(event) => {
                event.stopPropagation();
                onCloseTable(item.database, item.table, item.view);
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
    </div>
  );
}