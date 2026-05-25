import { redisDeleteKey, redisDeleteKeys, redisSetKey, redisUpdateKeyTtl } from "../../../services/keyClient";
import type { RedisSetKeyRequest } from "../../../types";

export async function saveRedisBrowserKey(connectionId: string, database: number, request: RedisSetKeyRequest) {
  await redisSetKey(connectionId, database, request);
}

export async function updateRedisBrowserKeyTtl(
  connectionId: string,
  database: number,
  key: string,
  ttlMs: number | null,
) {
  await redisUpdateKeyTtl(connectionId, database, { key, ttlMs });
}

export async function deleteRedisBrowserKeys(connectionId: string, database: number, keys: string[]) {
  if (keys.length === 1) {
    await redisDeleteKey(connectionId, database, keys[0]);
    return;
  }

  await redisDeleteKeys(connectionId, database, keys);
}
