/**
 * Wails v2 Runtime API wrapper
 * Provides compatibility with Tauri-like invoke() API
 *
 * In Wails v2, the runtime injects window.go.<package>.App with backend methods.
 */

declare global {
  interface Window {
    go?: {
      [packageName: string]: {
        App?: Record<string, (...args: any[]) => Promise<any>>;
      } | undefined;
    };
  }
}

// Debug logging — disabled for production startup speed
const DEBUG = false;
const log = (msg: string, data?: any) => {
  if (DEBUG) {
    console.log(`[Wails IPC] ${msg}`, data ?? "");
  }
};

function getWailsAppApi(): Record<string, (...args: any[]) => Promise<any>> | undefined {
  const go = window.go;
  if (!go) {
    return undefined;
  }

  // Prefer app package name (current project), keep backend/main as compatibility fallback.
  return go.app?.App ?? go.backend?.App ?? go.main?.App;
}

export function getWailsRuntimeSnapshot() {
  return {
    hasWindow: typeof window !== "undefined",
    hasGo: typeof window !== "undefined" ? typeof window.go : "undefined",
    hasApp: typeof window !== "undefined" ? typeof window.go?.app : "undefined",
    hasAppApp: typeof window !== "undefined" ? typeof window.go?.app?.App : "undefined",
    hasBackend: typeof window !== "undefined" ? typeof window.go?.backend : "undefined",
    hasBackendApp: typeof window !== "undefined" ? typeof window.go?.backend?.App : "undefined",
    hasMain: typeof window !== "undefined" ? typeof window.go?.main : "undefined",
    hasMainApp: typeof window !== "undefined" ? typeof window.go?.main?.App : "undefined",
  };
}

/**
 * Check if running in Wails environment
 */
export function isWails(): boolean {
  return (
    typeof window !== "undefined" &&
    getWailsAppApi() !== undefined
  );
}

// Cached promise so parallel callers share a single polling loop
let _wailsReadyPromise: Promise<void> | null = null;

/**
 * Wait for Wails to be ready.
 * Uses a cached promise so multiple callers share one polling loop.
 * Polls every 10ms (instead of 100ms) for fast detection.
 */
export function waitForWails(): Promise<void> {
  if (isWails()) {
    return Promise.resolve();
  }

  if (_wailsReadyPromise) {
    return _wailsReadyPromise;
  }

  _wailsReadyPromise = new Promise<void>((resolve) => {
    let attempts = 0;
    const maxAttempts = 500; // 5 seconds with 10ms interval

    const checkWails = () => {
      attempts++;
      if (isWails()) {
        log(`Wails ready after ${attempts * 10}ms`);
        resolve();
      } else if (attempts < maxAttempts) {
        setTimeout(checkWails, 10);
      } else {
        log("Wails initialization timeout");
        resolve(); // Resolve anyway to avoid hanging
      }
    };

    checkWails();
  });

  return _wailsReadyPromise;
}

/**
 * Methods that take a single string parameter wrapped in an object
 * Maps the command name to the parameter name
 */
const SINGLE_STRING_PARAM_METHODS: Record<string, string> = {
  "RedisDisconnect": "connectionId",
  "RedisListDatabases": "connectionId",
  "MysqlDisconnect": "connectionId",
  "MysqlPing": "connectionId",
  "MysqlListDatabases": "connectionId",
  "SaveState": "data",
};

/**
 * Methods that pass an object as a single parameter (not decomposed)
 * Maps the command name to the parameter name or true if entire args is passed
 */
const OBJECT_PARAM_METHODS: Record<string, boolean> = {
  "http_request": true,  // Pass the entire args object as HttpRequestParams
};

/**
 * Convert snake_case to PascalCase
 * e.g., "redis_connect" -> "RedisConnect"
 * Handles special cases like TTL
 */
function snakeToPascalCase(str: string): string {
  return str
    .split("_")
    .map(word => {
      // Special case for TTL
      if (word.toUpperCase() === "TTL") {
        return "TTL";
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join("");
}

/**
 * Extract parameter value from arguments object
 * For methods expecting simple types instead of objects
 */
function extractSimpleParam(methodName: string, args?: Record<string, any> | any): any {
  if (!args) {
    return undefined;
  }

  // Methods that should pass the entire object as a parameter
  if (OBJECT_PARAM_METHODS[methodName]) {
    return args;
  }

  // Methods with multiple string params - extract in correct order
  if (methodName === "MysqlQuery" && typeof args === "object") {
    // MysqlQuery(connectionID string, query string)
    return [args.connectionId, args.sql];
  }
  if (methodName === "MysqlDescribeTable" && typeof args === "object") {
    // MysqlDescribeTable(connectionID string, database string, tableName string)
    return [args.connectionId, args.database, args.table];
  }
  if (methodName === "MysqlListTables" && typeof args === "object") {
    // MysqlListTables(connectionID string, database string)
    return [args.connectionId, args.database];
  }

  // Single parameter methods - extract the value from the object
  const paramName = SINGLE_STRING_PARAM_METHODS[methodName];
  if (paramName && typeof args === "object") {
    return args[paramName];
  }

  return args;
}

/**
 * Invoke a backend command
 *
 * @param cmd - Command name to invoke (e.g., "redis_connect", "mysql_query")
 * @param args - Arguments to pass (optional)
 * @returns Promise with the result
 */
export async function invoke<T = any>(
  cmd: string,
  args?: Record<string, any> | any
): Promise<T> {
  log(`invoke("${cmd}") called`, args);

  await waitForWails();

  if (!isWails()) {
    const msg = `Wails runtime not available. Make sure you're running in a Wails environment.`;
    log(`ERROR: ${msg}`);
    throw new Error(msg);
  }

  // Convert snake_case command name to PascalCase to match Go method names
  const methodName = snakeToPascalCase(cmd);
  const appApi = getWailsAppApi();
  const handler = appApi?.[methodName];

  if (typeof handler !== "function") {
    const msg = `Unknown command: ${cmd} (resolved to ${methodName})`;
    log(`ERROR: ${msg}`);
    throw new Error(msg);
  }

  try {
    log(`Calling App["${methodName}"](...)`);
    // Extract parameters based on method type
    const params = extractSimpleParam(methodName, args);
    log(`Extracted params for ${methodName}:`, params);

    // Handle methods with multiple parameters (spread as arguments)
    const result = Array.isArray(params)
      ? await handler(...params)
      : (params !== undefined ? await handler(params) : await handler());

    log(`invoke("${cmd}") succeeded`, result);
    return result as T;
  } catch (error) {
    log(`invoke("${cmd}") failed`, error);
    throw error;
  }
}
