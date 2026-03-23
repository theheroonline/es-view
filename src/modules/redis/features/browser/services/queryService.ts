import { redisListDatabases } from "../../../services/databaseClient";
import { redisGetKeyDetail, redisScanKeys } from "../../../services/keyClient";

export function normalizeRedisPattern(pattern: string) {
  const trimmedPattern = pattern.trim();
  if (!trimmedPattern) {
    return "*";
  }

  let normalizedPattern = trimmedPattern;
  if (!normalizedPattern.startsWith("*")) {
    normalizedPattern = `*${normalizedPattern}`;
  }
  if (!normalizedPattern.endsWith("*")) {
    normalizedPattern = `${normalizedPattern}*`;
  }

  return normalizedPattern;
}

export async function loadRedisDatabases(connectionId: string) {
  return redisListDatabases(connectionId);
}

export async function loadRedisKeyDetail(connectionId: string, database: number, key: string) {
  return redisGetKeyDetail(connectionId, database, key);
}

export async function scanRedisKeys(
  connectionId: string,
  database: number,
  pattern: string,
  cursor: string,
  count: number,
) {
  return redisScanKeys(connectionId, database, normalizeRedisPattern(pattern), cursor, count);
}
