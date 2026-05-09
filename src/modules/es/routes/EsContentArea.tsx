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
