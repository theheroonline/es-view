import type { ConnectionProfile } from "../types";
import type { EngineKey, NormalizedConnectionProfile } from "./types";

export function getProfileEngine(profile?: ConnectionProfile | null): EngineKey {
  if (!profile || !profile.engine) {
    return "elasticsearch";
  }
  if (profile.engine === "mysql") {
    return "mysql";
  }
  if (profile.engine === "redis") {
    return "redis";
  }
  return "elasticsearch";
}

export function normalizeConnectionProfile(profile: ConnectionProfile): NormalizedConnectionProfile {
  return {
    ...profile,
    engine: getProfileEngine(profile),
    ssh: {
      enabled: profile.ssh?.enabled ?? false,
      host: profile.ssh?.host ?? "",
      port: profile.ssh?.port ?? 22,
      username: profile.ssh?.username ?? "",
    },
  };
}