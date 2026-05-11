import { useLocation } from "react-router-dom";
import EsDataBrowserPage from "../pages/DataBrowser";
import EsIndexManagerPage from "../pages/IndexManager";
import EsRestConsolePage from "../pages/RestConsole";
import EsSqlQueryPage from "../pages/SqlQuery";

const flexVisible: React.CSSProperties = { display: "flex", flex: 1, minHeight: 0, overflow: "hidden" };
const flexHidden: React.CSSProperties = { display: "none" };

/**
 * Mounts ALL engine pages simultaneously and toggles visibility via CSS display.
 * This matches browser tab behavior: components stay mounted, state is preserved,
 * and switching tabs causes zero flicker or re-query.
 */
export function EsContentArea() {
  const { pathname } = useLocation();

  return (
    <div className="engine-page-wrapper" style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <div style={pathname === "/data" ? flexVisible : flexHidden}>
        <EsDataBrowserPage />
      </div>
      <div style={pathname === "/sql" ? flexVisible : flexHidden}>
        <EsSqlQueryPage />
      </div>
      <div style={pathname === "/rest" ? flexVisible : flexHidden}>
        <EsRestConsolePage />
      </div>
      <div style={pathname === "/indices" ? flexVisible : flexHidden}>
        <EsIndexManagerPage />
      </div>
    </div>
  );
}
