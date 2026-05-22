import { useLocation } from "react-router-dom";
import EsDataBrowserPage from "../pages/DataBrowser";
import EsIndexManagerPage from "../pages/IndexManager";
import EsRestConsolePage from "../pages/RestConsole";
import EsSimpleQueryPage from "../pages/SimpleQuery";
import EsTemplateManagerPage from "../pages/TemplateManager";
import EsIlmManagerPage from "../pages/IlmManager";
import EsClusterInfoPage from "../pages/ClusterInfo";

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
        <EsSimpleQueryPage />
      </div>
      <div style={pathname === "/rest" ? flexVisible : flexHidden}>
        <EsRestConsolePage />
      </div>
      <div style={pathname === "/indices" ? flexVisible : flexHidden}>
        <EsIndexManagerPage />
      </div>
      <div style={pathname === "/templates" ? flexVisible : flexHidden}>
        <EsTemplateManagerPage />
      </div>
      <div style={pathname === "/ilm" ? flexVisible : flexHidden}>
        <EsIlmManagerPage />
      </div>
      <div style={pathname === "/cluster" ? flexVisible : flexHidden}>
        <EsClusterInfoPage />
      </div>
    </div>
  );
}
