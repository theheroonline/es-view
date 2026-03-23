export function mapInvokeError(error: unknown, context?: { message?: string }) {
  if (error instanceof Error) {
    return error;
  }

  const fallbackMessage = context?.message ?? "Desktop invocation failed";
  if (typeof error === "string") {
    return new Error(error || fallbackMessage);
  }

  return new Error(fallbackMessage);
}