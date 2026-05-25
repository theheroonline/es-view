import { invoke } from "../../wailsapi";
import { mapInvokeError } from "../mapInvokeError";
import { requireDesktop } from "../requireDesktop";

export async function invokeDesktop<T = any>(
  command: string,
  payload?: Record<string, any> | any,
  options?: { featureName?: string; errorMessage?: string }
): Promise<T> {
  await requireDesktop(options?.featureName);

  try {
    return await invoke<T>(command, payload);
  } catch (error) {
    throw mapInvokeError(error, { message: options?.errorMessage });
  }
}