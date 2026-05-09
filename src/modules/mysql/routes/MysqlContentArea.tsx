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

  return (
    <>
      {pages.map(([path, element]) => (
        <div key={path} className="engine-page-wrapper" data-active={pathname === path ? "true" : "false"}>
          {element}
        </div>
      ))}
    </>
  );
}
