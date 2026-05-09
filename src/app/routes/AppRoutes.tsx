import { Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import EsDataBrowserPage from "../../modules/es/pages/DataBrowser";
import EsIndexManagerPage from "../../modules/es/pages/IndexManager";
import EsRestConsolePage from "../../modules/es/pages/RestConsole";
import EsSqlQueryPage from "../../modules/es/pages/SqlQuery";
import MysqlSqlQueryPage from "../../modules/mysql/pages/SqlQuery";
import MysqlTableManagerPage from "../../modules/mysql/pages/TableManager";
import RedisBrowserPage from "../../modules/redis/pages/Browser";
import RedisConsolePage from "../../modules/redis/pages/Console";

function WorkspaceLoadingFallback() {
  return (
    <div className="card mdb-empty-state-card">
      <span className="muted">Loading...</span>
    </div>
  );
}

const pageByPath: Record<string, React.ReactNode> = {
  "/data": <EsDataBrowserPage />,
  "/sql": <EsSqlQueryPage />,
  "/rest": <EsRestConsolePage />,
  "/indices": <EsIndexManagerPage />,
  "/mysql/tables": <MysqlTableManagerPage />,
  "/mysql/table": <MysqlTableManagerPage />,
  "/mysql/sql": <MysqlSqlQueryPage />,
  "/redis/browser": <RedisBrowserPage />,
  "/redis/console": <RedisConsolePage />,
};

export default function AppRoutes() {
  const location = useLocation();
  const navigate = useNavigate();

  // Redirect bare engine paths to their default pages
  useEffect(() => {
    if (location.pathname === "/mysql") {
      navigate("/mysql/tables", { replace: true });
    } else if (location.pathname === "/redis") {
      navigate("/redis/browser", { replace: true });
    }
  }, [location.pathname, navigate]);

  return (
    <Suspense fallback={<WorkspaceLoadingFallback />}>
      {/*
       * All pages are rendered simultaneously — only visibility is toggled.
       * This keeps component state (scroll position, filter, data, etc.) alive
       * across tab switches, like browser tabs.
       */}
      <Routes>
        <Route path="/mysql" element={<Navigate to="/mysql/tables" replace />} />
        <Route path="/redis" element={<Navigate to="/redis/browser" replace />} />
        <Route path="*" element={null} />
      </Routes>

      {Object.entries(pageByPath).map(([path, element]) => (
        <div key={path} style={{ display: location.pathname === path ? "block" : "none" }}>
          {element}
        </div>
      ))}
    </Suspense>
  );
}
