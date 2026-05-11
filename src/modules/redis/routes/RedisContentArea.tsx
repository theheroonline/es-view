import { useLocation } from "react-router-dom";
import RedisBrowserPage from "../pages/Browser";
import RedisConsolePage from "../pages/Console";

const pages: [string, React.ReactNode][] = [
  ["/redis/browser", <RedisBrowserPage />],
  ["/redis/console", <RedisConsolePage />],
];

export function RedisContentArea() {
  const { pathname } = useLocation();
  const currentPage = pages.find(([path]) => pathname === path);

  if (!currentPage) return null;

  return (
    <div className="engine-page-wrapper">
      {currentPage[1]}
    </div>
  );
}
