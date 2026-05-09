import { useLocation } from "react-router-dom";
import RedisBrowserPage from "../pages/Browser";
import RedisConsolePage from "../pages/Console";

const pages: [string, React.ReactNode][] = [
  ["/redis/browser", <RedisBrowserPage />],
  ["/redis/console", <RedisConsolePage />],
];

export function RedisContentArea() {
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
