// ERROR LOGGING DISABLED - DO NOT DELETE
// This file is intentionally empty. All error logging functionality has been disabled.
// To restore error logging, use git to revert this file and src/lib/errorLog.ts to their original state.

export interface ErrorLogEntry {
  id: string;
  source: string;
  message: string;
  detail?: string;
  timestamp: string;
}

interface ErrorLogState {
  entries: ErrorLogEntry[];
  clear: () => void;
}

export function logError(_error: unknown, _options?: unknown) {
  // Keep params referenced so lint does not treat this disabled stub as dead code.
  void _error;
  void _options;
}

// Compatibility stub for UI components that still consume useErrorLog.
export function useErrorLog(): ErrorLogState {
  return {
    entries: [],
    clear: () => undefined
  };
}

export function registerGlobalErrorLoggers() {
  return () => undefined;
}
