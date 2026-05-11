import { NavLink } from "react-router-dom";

interface EsWorkspaceTabsProps {
  dataBrowserLabel: string;
  sqlQueryLabel: string;
  restConsoleLabel: string;
  indexManagerLabel: string;
}

export default function EsWorkspaceTabs({
  dataBrowserLabel,
  sqlQueryLabel,
  restConsoleLabel,
  indexManagerLabel,
}: EsWorkspaceTabsProps) {
  return (
    <div className="mdb-tabs">
      <NavLink to="/data" className={({ isActive }) => `mdb-tab ${isActive ? "active" : ""}`}>
        {dataBrowserLabel}
      </NavLink>
      <NavLink to="/sql" className={({ isActive }) => `mdb-tab ${isActive ? "active" : ""}`}>
        {sqlQueryLabel}
      </NavLink>
      <NavLink to="/rest" className={({ isActive }) => `mdb-tab ${isActive ? "active" : ""}`}>
        {restConsoleLabel}
      </NavLink>
      <NavLink to="/indices" className={({ isActive }) => `mdb-tab ${isActive ? "active" : ""}`}>
        {indexManagerLabel}
      </NavLink>
    </div>
  );
}
