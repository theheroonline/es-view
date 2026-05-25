import { useLocation } from "react-router-dom";
import MysqlSqlQueryPage from "../pages/SqlQuery";
import MysqlTableManagerPage from "../pages/TableManager";

const flexVisible: React.CSSProperties = { display: "flex", flex: 1, minHeight: 0, overflow: "hidden" };
const flexHidden: React.CSSProperties = { display: "none" };

/**
 * Mounts ALL MySQL pages simultaneously and toggles visibility via CSS display.
 * Preserves state (opened tables, filters, pagination) across tab switches.
 *
 * Note: Both /mysql/tables and /mysql/table render the same TableManager component.
 * The component internally reads useLocation() to switch between overview and table
 * data views, so only one instance is needed.
 */
export function MysqlContentArea() {
  const { pathname } = useLocation();

  const isTablePage = pathname === "/mysql/tables" || pathname === "/mysql/table";

  return (
    <div className="engine-page-wrapper" style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <div style={isTablePage ? flexVisible : flexHidden}>
        <MysqlTableManagerPage />
      </div>
      <div style={pathname === "/mysql/sql" ? flexVisible : flexHidden}>
        <MysqlSqlQueryPage />
      </div>
    </div>
  );
}
