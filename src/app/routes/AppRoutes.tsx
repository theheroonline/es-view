import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

const EsDataBrowserPage = lazy(() => import("../../modules/es/pages/DataBrowser"));
const EsIndexManagerPage = lazy(() => import("../../modules/es/pages/IndexManager"));
const EsRestConsolePage = lazy(() => import("../../modules/es/pages/RestConsole"));
const EsSqlQueryPage = lazy(() => import("../../modules/es/pages/SqlQuery"));
const MysqlSqlQueryPage = lazy(() => import("../../modules/mysql/pages/SqlQuery"));
const MysqlTableManagerPage = lazy(() => import("../../modules/mysql/pages/TableManager"));
const RedisBrowserPage = lazy(() => import("../../modules/redis/pages/Browser"));
const RedisConsolePage = lazy(() => import("../../modules/redis/pages/Console"));

function WorkspaceLoadingFallback() {
  return (
    <div className="card mdb-empty-state-card">
      <span className="muted">Loading...</span>
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<WorkspaceLoadingFallback />}>
      <Routes>
        <Route path="/" element={null} />
        <Route path="/data" element={<EsDataBrowserPage />} />
        <Route path="/sql" element={<EsSqlQueryPage />} />
        <Route path="/rest" element={<EsRestConsolePage />} />
        <Route path="/indices" element={<EsIndexManagerPage />} />
        <Route path="/mysql" element={<Navigate to="/mysql/tables" replace />} />
        <Route path="/mysql/sql" element={<MysqlSqlQueryPage />} />
        <Route path="/mysql/tables" element={<MysqlTableManagerPage />} />
        <Route path="/mysql/table" element={<MysqlTableManagerPage />} />
        <Route path="/redis" element={<Navigate to="/redis/browser" replace />} />
        <Route path="/redis/browser" element={<RedisBrowserPage />} />
        <Route path="/redis/console" element={<RedisConsolePage />} />
        <Route path="*" element={null} />
      </Routes>
    </Suspense>
  );
}
