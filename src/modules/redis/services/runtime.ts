import { requireDesktop } from "../../../lib/transport/requireDesktop";
import { invokeDesktop } from "../../../lib/transport/wails/invokeDesktop";

const REDIS_FEATURE_NAME = "Redis operations";

export async function requireRedisDesktopMode() {
  await requireDesktop(REDIS_FEATURE_NAME);
}

export async function invokeRedis<T>(command: string, args: Record<string, unknown>, options?: { errorMessage?: string }) {
  return invokeDesktop<T>(command, args, {
    featureName: REDIS_FEATURE_NAME,
    errorMessage: options?.errorMessage,
  });
}