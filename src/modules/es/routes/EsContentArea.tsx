import { useLocation } from "react-router-dom";
import EsDataBrowserPage from "../pages/DataBrowser";
import EsIndexManagerPage from "../pages/IndexManager";
import EsRestConsolePage from "../pages/RestConsole";
import EsSqlQueryPage from "../pages/SqlQuery";

const pages: [string, React.ReactNode][] = [
  ["/data", <EsDataBrowserPage />],
  ["/sql", <EsSqlQueryPage />],
  ["/rest", <EsRestConsolePage />],
  ["/indices", <EsIndexManagerPage />],
];

export function EsContentArea() {
  const { pathname } = useLocation();
  const currentPage = pages.find(([path]) => pathname === path);

  if (!currentPage) return null;

  return (
    <div className="engine-page-wrapper">
      {currentPage[1]}
    </div>
  );
}
