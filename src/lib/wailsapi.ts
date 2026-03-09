/**
 * Wails v2 Runtime API wrapper
 * Provides compatibility with Tauri-like invoke() API
 *
 * In Wails v2, the runtime injects window.go.main.App with all backend methods.
 */

declare global {
  interface Window {
    go?: {
      main?: {
        App?: Record<string, (...args: any[]) => Promise<any>>;
      };
    };
  }
}

// Debug logging
const DEBUG = true;
const log = (msg: string, data?: any) => {
  if (DEBUG) {
    console.log(`[Wails IPC] ${msg}`, data ?? "");
  }
};

/**
 * Check if running in Wails environment
 */
export function isWails(): boolean {
  return (
    typeof window !== "undefined" &&
    window.go?.main?.App !== undefined
  );
}

/**
 * Wait for Wails to be ready
 */
export async function waitForWails(): Promise<void> {
  if (isWails()) {
    log("Wails is ready");
    return;
  }

  log("Waiting for Wails to be ready...");

  // Poll for Wails initialization
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 150; // 15 seconds with 100ms interval

    const checkWails = () => {
      attempts++;
      if (isWails()) {
        log(`Wails ready after ${attempts * 100}ms`);
        resolve();
      } else if (attempts < maxAttempts) {
        setTimeout(checkWails, 100);
      } else {
        log("Wails initialization timeout");
        resolve(); // Resolve anyway to avoid hanging
      }
    };

    checkWails();
  });
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
  "MysqlListTables": "connectionId",  // Frontend passes {connectionId, database} but backend only needs connectionId
  "SaveState": "data",
};

/**
 * Convert snake_case to PascalCase
 * e.g., "redis_connect" -> "RedisConnect"
 */
function snakeToPascalCase(str: string): string {
  return str
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
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

  // Methods with multiple string params - extract in correct order
  if (methodName === "MysqlQuery" && typeof args === "object") {
    // MysqlQuery(connectionID string, query string)
    return [args.connectionId, args.sql];
  }
  if (methodName === "MysqlDescribeTable" && typeof args === "object") {
    // MysqlDescribeTable(connectionID string, tableName string)
    // Frontend passes connectionId, database, table - we need connectionId and table
    return [args.connectionId, args.table];
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
 * Compatible with Tauri's invoke API
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
  const handler = window.go?.main?.App?.[methodName];

  if (typeof handler !== "function") {
    const msg = `Unknown command: ${cmd} (resolved to ${methodName})`;
    log(`ERROR: ${msg}`);
    throw new Error(msg);
  }

  try {
    log(`Calling window.go.main.App["${methodName}"](...)`);
    // Extract parameters based on method type
    const params = extractSimpleParam(methodName, args);

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

/**
 * Alias for compatibility with Tauri code
 */
export const isTauri = isWails;
