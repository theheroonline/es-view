import { NavLink } from "react-router-dom";

interface RedisWorkspaceTabsProps {
  browserLabel: string;
  consoleLabel: string;
  visible: boolean;
}

export default function RedisWorkspaceTabs({
  browserLabel,
  consoleLabel,
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
    </div>
  );
}
