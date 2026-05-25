import { logError } from "../../../lib/errorLog";
import type { RedisCommandResult } from "../types";
import { invokeRedis, requireRedisDesktopMode } from "./runtime";

export async function redisExecute(
  connectionId: string,
  database: number,
  command: string,
  args: string[],
): Promise<RedisCommandResult> {
  await requireRedisDesktopMode();
  try {
    return await invokeRedis<RedisCommandResult>("redis_execute", {
      connectionId,
      database,
      command,
      args,
    }, {
      errorMessage: `Redis execute failed for ${command}`,
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