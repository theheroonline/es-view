import type { ConnectionProfile } from "../types";

export type EngineKey = "elasticsearch" | "mysql" | "redis";

export type NormalizedConnectionProfile = ConnectionProfile & {
  engine: EngineKey;
  ssh: {
    enabled: boolean;
    host?: string;
    port?: number;
    username?: string;
  };
};