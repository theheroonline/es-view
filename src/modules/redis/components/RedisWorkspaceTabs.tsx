import { NavLink } from "react-router-dom";

interface RedisWorkspaceTabsProps {
  browserLabel: string;
  consoleLabel: string;
}

export default function RedisWorkspaceTabs({
  browserLabel,
  consoleLabel,
}: RedisWorkspaceTabsProps) {
  return (
    <div className="mdb-tabs">
      <NavLink to="/redis/browser" className={({ isActive }) => `mdb-tab ${isActive ? "active" : ""}`}>
        {browserLabel}
      </NavLink>
      <NavLink to="/redis/console" className={({ isActive }) => `mdb-tab ${isActive ? "active" : ""}`}>
        {consoleLabel}
      </NavLink>
    </div>
  );
}
