import type { EngineType } from "../hooks/useConnectionWorkspace";

const PATH_ENGINE_MAP: Array<{ prefixes: string[]; engine: EngineType }> = [
  { prefixes: ["/mysql/"], engine: "mysql" },
  { prefixes: ["/redis/"], engine: "redis" },
];

const ES_PATHS: string[] = ["/data", "/sql", "/rest", "/indices", "/templates", "/ilm", "/cluster"];

export function getEngineFromPath(pathname: string): EngineType | null {
  for (const { prefixes, engine } of PATH_ENGINE_MAP) {
    if (prefixes.some((p) => pathname.startsWith(p))) {
      return engine;
    }
  }
  if (ES_PATHS.includes(pathname)) {
    return "elasticsearch";
  }
  return null;
}

export function hasEngineRoute(pathname: string): boolean {
  return getEngineFromPath(pathname) !== null;
}
