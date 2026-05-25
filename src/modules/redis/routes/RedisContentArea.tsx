import { useLocation } from "react-router-dom";
import RedisBrowserPage from "../pages/Browser";
import RedisConsolePage from "../pages/Console";

const flexVisible: React.CSSProperties = { display: "flex", flex: 1, minHeight: 0, overflow: "hidden" };
const flexHidden: React.CSSProperties = { display: "none" };

/**
 * Mounts ALL Redis pages simultaneously and toggles visibility via CSS display.
 * Preserves browser state (keys, selected key, search pattern) across tab switches.
 */
export function RedisContentArea() {
  const { pathname } = useLocation();

  return (
    <div className="engine-page-wrapper" style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <div style={pathname === "/redis/browser" ? flexVisible : flexHidden}>
        <RedisBrowserPage />
      </div>
      <div style={pathname === "/redis/console" ? flexVisible : flexHidden}>
        <RedisConsolePage />
      </div>
    </div>
  );
}
