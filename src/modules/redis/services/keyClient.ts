import { logError } from "../../../lib/errorLog";
import type {
    RedisKeyDetail,
    RedisScanResult,
    RedisSetKeyRequest,
    RedisUpdateTtlRequest,
} from "../types";
import { invokeRedis, requireRedisDesktopMode } from "./runtime";

export async function redisScanKeys(
  connectionId: string,
  database: number,
  pattern: string,
  cursor = "0",
  count = 50,
): Promise<RedisScanResult> {
  await requireRedisDesktopMode();
  try {
    return await invokeRedis<RedisScanResult>("redis_scan_keys", {
      connectionId,
      database,
      pattern,
      cursor,
      count,
    }, {
      errorMessage: `Redis scan keys failed for ${connectionId}`,
    });
  } catch (error) {
    logError(error, {
      source: "redisClient.scanKeys",
      message: `Failed to scan Redis keys for connection ${connectionId}`,
      detail: { database, pattern, cursor, count }
    });
    throw error;
  }
}

export async function redisGetKeyDetail(
  connectionId: string,
  database: number,
  key: string,
): Promise<RedisKeyDetail> {
  await requireRedisDesktopMode();
  try {
    return await invokeRedis<RedisKeyDetail>("redis_get_key_detail", {
      connectionId,
      database,
      key,
    }, {
      errorMessage: `Redis get key detail failed for ${key}`,
    });
  } catch (error) {
    logError(error, {
      source: "redisClient.getKeyDetail",
      message: `Failed to load Redis key detail ${key}`,
      detail: { connectionId, database }
    });
    throw error;
  }
}

export async function redisSetKey(
  connectionId: string,
  database: number,
  request: RedisSetKeyRequest,
): Promise<void> {
  await requireRedisDesktopMode();
  try {
    await invokeRedis<void>("redis_set_key", {
      connectionId,
      database,
      key: request.key,
      originalKey: request.originalKey,
      keyType: request.keyType,
      ttlMs: request.ttlMs,
      value: request.value,
      overwrite: request.overwrite,
    }, {
      errorMessage: `Redis set key failed for ${request.key}`,
    });
  } catch (error) {
    logError(error, {
      source: "redisClient.setKey",
      message: `Failed to write Redis key ${request.key}`,
      detail: { connectionId, database, keyType: request.keyType }
    });
    throw error;
  }
}

export async function redisDeleteKey(
  connectionId: string,
  database: number,
  key: string,
): Promise<void> {
  await requireRedisDesktopMode();
  try {
    await invokeRedis<void>("redis_delete_key", {
      connectionId,
      database,
      key,
    }, {
      errorMessage: `Redis delete key failed for ${key}`,
    });
  } catch (error) {
    logError(error, {
      source: "redisClient.deleteKey",
      message: `Failed to delete Redis key ${key}`,
      detail: { connectionId, database }
    });
    throw error;
  }
}

export async function redisDeleteKeys(
  connectionId: string,
  database: number,
  keys: string[],
): Promise<number> {
  await requireRedisDesktopMode();
  try {
    return await invokeRedis<number>("redis_delete_keys", {
      connectionId,
      database,
      keys,
    }, {
      errorMessage: `Redis delete keys failed for ${connectionId}`,
    });
  } catch (error) {
    logError(error, {
      source: "redisClient.deleteKeys",
      message: `Failed to delete Redis keys (${keys.length})`,
      detail: { connectionId, database, keys }
    });
    throw error;
  }
}

export async function redisUpdateKeyTtl(
  connectionId: string,
  database: number,
  request: RedisUpdateTtlRequest,
): Promise<void> {
  await requireRedisDesktopMode();
  try {
    await invokeRedis<void>("redis_update_key_ttl", {
      connectionId,
      database,
      key: request.key,
      ttl: request.ttlMs,
    }, {
      errorMessage: `Redis update TTL failed for ${request.key}`,
    });
  } catch (error) {
    logError(error, {
      source: "redisClient.updateKeyTtl",
      message: `Failed to update Redis TTL ${request.key}`,
      detail: { connectionId, database, ttlMs: request.ttlMs }
    });
    throw error;
  }
}