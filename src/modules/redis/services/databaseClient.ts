import { logError } from "../../../lib/errorLog";
import type { RedisDatabaseInfo } from "../types";
import { invokeRedis, requireRedisDesktopMode } from "./runtime";

export async function redisListDatabases(connectionId: string): Promise<RedisDatabaseInfo[]> {
  await requireRedisDesktopMode();
  try {
    return await invokeRedis<RedisDatabaseInfo[]>("redis_list_databases", { connectionId }, {
      errorMessage: `Redis list databases failed for ${connectionId}`,
    });
  } catch (error) {
    logError(error, {
      source: "redisClient.listDatabases",
      message: `Failed to list Redis databases for connection ${connectionId}`
    });
    throw error;
  }
}