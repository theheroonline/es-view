import { useLocation } from "react-router-dom";
import MysqlSqlQueryPage from "../pages/SqlQuery";
import MysqlTableManagerPage from "../pages/TableManager";

const pages: [string, React.ReactNode][] = [
  ["/mysql/tables", <MysqlTableManagerPage />],
  ["/mysql/table", <MysqlTableManagerPage />],
  ["/mysql/sql", <MysqlSqlQueryPage />],
];

export function MysqlContentArea() {
  const { pathname } = useLocation();
  const currentPage = pages.find(([path]) => pathname === path);

  if (!currentPage) return null;

  return (
    <div className="engine-page-wrapper">
      {currentPage[1]}
    </div>
  );
}
