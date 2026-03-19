// ERROR LOGGING DISABLED - DO NOT DELETE
// This file is intentionally empty. All error logging functionality has been disabled.
// To restore error logging, use git to revert this file and src/lib/errorLog.ts to their original state.

export function logError(_error: unknown, _options?: unknown) {
  // do nothing
}

export function registerGlobalErrorLoggers() {
  return () => undefined;
}
