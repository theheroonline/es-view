import { NavLink } from "react-router-dom";

interface RedisWorkspaceTabsProps {
  browserLabel: string;
  consoleLabel: string;
  connectionsLabel: string;
  showConnectionsTab: boolean;
  visible: boolean;
}

export default function RedisWorkspaceTabs({
  browserLabel,
  consoleLabel,
  connectionsLabel,
  showConnectionsTab,
  visible,
}: RedisWorkspaceTabsProps) {
  return (
    <div className="mdb-tabs" style={{ display: visible ? "flex" : "none" }}>
      <NavLink to="/redis/browser" className={({ isActive }) => `mdb-tab ${isActive ? "active" : ""}`}>
        {browserLabel}
      </NavLink>
      <NavLink to="/redis/console" className={({ isActive }) => `mdb-tab ${isActive ? "active" : ""}`}>
        {consoleLabel}
      </NavLink>
      {showConnectionsTab ? (
        <NavLink to="/redis/connections" className={({ isActive }) => `mdb-tab ${isActive ? "active" : ""}`}>
          {connectionsLabel}
        </NavLink>
      ) : null}
    </div>
  );
}