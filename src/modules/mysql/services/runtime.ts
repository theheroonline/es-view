import { requireDesktop } from "../../../lib/transport/requireDesktop";
import { invokeDesktop } from "../../../lib/transport/wails/invokeDesktop";

export async function requireMysqlDesktopMode() {
  await requireDesktop("MySQL operations");
}

export async function invokeMysql<T>(command: string, payload: Record<string, unknown>): Promise<T> {
  return invokeDesktop<T>(command, payload, {
    featureName: "MySQL operations",
    errorMessage: `MySQL desktop invocation failed for ${command}`,
  });
}