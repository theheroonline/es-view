import { logError } from "../../../lib/errorLog";
import { invoke, isWails, waitForWails } from "../../../lib/wailsapi";
import type {
  RedisCommandResult,
  RedisConnection,
  RedisDatabaseInfo,
  RedisKeyDetail,
  RedisScanResult,
  RedisSetKeyRequest,
  RedisUpdateTtlRequest,
} from "../types";

async function requireWails() {
  // Wait for Wails to initialize
  await waitForWails();

  // Add short retry for robustness - try up to 3 times with 50ms between retries
  for (let i = 0; i < 3; i++) {
    if (isWails()) {
      return;
    }
    // Wait 50ms and retry (max total 150ms vs 4 seconds before)
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  // If still not available, throw detailed error
  throw new Error(
    `Redis operations require desktop mode (Wails). ` +
    `window.go: ${typeof window.go}, ` +
    `window.go.main: ${typeof window.go?.main}, ` +
    `window.go.main.App: ${typeof window.go?.main?.App}`
  );
}

export async function redisConnect(connection: RedisConnection): Promise<void> {
  await requireWails();
  try {
    await invoke("redis_connect", {
      connectionId: connection.id,
      host: connection.host,
      port: connection.port,
      database: connection.database,
      username: connection.username || undefined,
      password: connection.password || undefined,
    });
  } catch (error) {
    logError(error, {
      source: "redisClient.connect",
      message: `Failed to connect to Redis ${connection.name}`
    });
    throw error;
  }
}

export async function redisDisconnect(connectionId: string): Promise<void> {
  await requireWails();
  try {
    await invoke("redis_disconnect", { connectionId });
  } catch (error) {
    logError(error, {
      source: "redisClient.disconnect",
      message: `Failed to disconnect Redis connection ${connectionId}`
    });
    throw error;
  }
}

export async function redisListDatabases(connectionId: string): Promise<RedisDatabaseInfo[]> {
  await requireWails();
  try {
    return await invoke<RedisDatabaseInfo[]>("redis_list_databases", { connectionId });
  } catch (error) {
    logError(error, {
      source: "redisClient.listDatabases",
      message: `Failed to list Redis databases for connection ${connectionId}`
    });
    throw error;
  }
}

export async function redisScanKeys(
  connectionId: string,
  database: number,
  pattern: string,
  cursor = "0",
  count = 50,
): Promise<RedisScanResult> {
  await requireWails();
  try {
    return await invoke<RedisScanResult>("redis_scan_keys", {
      connectionId,
      database,
      pattern,
      cursor,
      count,
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
  await requireWails();
  try {
    return await invoke<RedisKeyDetail>("redis_get_key_detail", {
      connectionId,
      database,
      key,
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

export async function redisExecute(
  connectionId: string,
  database: number,
  command: string,
  args: string[],
): Promise<RedisCommandResult> {
  await requireWails();
  try {
    return await invoke<RedisCommandResult>("redis_execute", {
      connectionId,
      database,
      command,
      args,
    });
  } catch (error) {
    logError(error, {
      source: "redisClient.execute",
      message: `Failed to execute Redis command ${command}`,
      detail: { connectionId, database, args }
    });
    throw error;
  }
}

export async function redisSetKey(
  connectionId: string,
  database: number,
  request: RedisSetKeyRequest,
): Promise<void> {
  await requireWails();
  try {
    await invoke("redis_set_key", {
      connectionId,
      database,
      key: request.key,
      originalKey: request.originalKey,
      keyType: request.keyType,
      ttlMs: request.ttlMs,
      value: request.value,
      overwrite: request.overwrite,
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
  await requireWails();
  try {
    await invoke("redis_delete_key", {
      connectionId,
      database,
      key,
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
  await requireWails();
  try {
    return await invoke<number>("redis_delete_keys", {
      connectionId,
      database,
      keys,
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
  await requireWails();
  try {
    await invoke("redis_update_key_ttl", {
      connectionId,
      database,
      key: request.key,
      ttl: request.ttlMs,
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