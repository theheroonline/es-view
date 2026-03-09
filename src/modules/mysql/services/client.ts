import { invoke, isWails, waitForWails } from "../../../lib/wailsapi";
import { logError } from "../../../lib/errorLog";
import type { ColumnMeta, MysqlConnection } from "../types";

async function requireWails() {
  // Wait for Wails to initialize
  await waitForWails();

  // Add extra wait and retry for robustness - try up to 20 times with 200ms between retries
  for (let i = 0; i < 20; i++) {
    if (isWails()) {
      return;
    }
    // Wait 200ms and retry
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // If still not available, throw detailed error
  throw new Error(
    `MySQL operations require desktop mode (Wails). ` +
    `window.go: ${typeof window.go}, ` +
    `window.go.main: ${typeof window.go?.main}, ` +
    `window.go.main.App: ${typeof window.go?.main?.App}`
  );
}

export async function mysqlConnect(connection: MysqlConnection): Promise<void> {
  await requireWails();
  try {
    await invoke("mysql_connect", {
      connectionId: connection.id,
      host: connection.host,
      port: connection.port,
      username: connection.username ?? "",
      password: connection.password ?? "",
      database: connection.database || undefined,
    });
  } catch (error) {
    logError(error, {
      source: "mysqlClient.connect",
      message: `Failed to connect to MySQL ${connection.name}`
    });
    throw error;
  }
}

export async function mysqlDisconnect(connectionId: string): Promise<void> {
  await requireWails();
  try {
    await invoke("mysql_disconnect", { connectionId });
  } catch (error) {
    logError(error, {
      source: "mysqlClient.disconnect",
      message: `Failed to disconnect MySQL connection ${connectionId}`
    });
    throw error;
  }
}

export async function mysqlPing(connectionId: string): Promise<void> {
  await requireWails();
  try {
    await invoke("mysql_ping", { connectionId });
  } catch (error) {
    logError(error, {
      source: "mysqlClient.ping",
      message: `Failed to ping MySQL connection ${connectionId}`
    });
    throw error;
  }
}

export interface MysqlQueryResult {
  columns: string[];
  rows: Array<Array<unknown>>;
  affectedRows: number;
  isResultSet: boolean;
}

export async function mysqlQuery(
  connectionId: string,
  sql: string
): Promise<MysqlQueryResult> {
  await requireWails();
  try {
    return await invoke<MysqlQueryResult>("mysql_query", { connectionId, sql });
  } catch (error) {
    logError(error, {
      source: "mysqlClient.query",
      message: `Failed to execute MySQL query on connection ${connectionId}`,
      detail: sql
    });
    throw error;
  }
}

export async function mysqlListDatabases(
  connectionId: string
): Promise<string[]> {
  await requireWails();
  try {
    return await invoke<string[]>("mysql_list_databases", { connectionId });
  } catch (error) {
    logError(error, {
      source: "mysqlClient.listDatabases",
      message: `Failed to list MySQL databases for connection ${connectionId}`
    });
    throw error;
  }
}

export async function mysqlListTables(
  connectionId: string,
  database: string
): Promise<string[]> {
  await requireWails();
  try {
    return await invoke<string[]>("mysql_list_tables", { connectionId, database });
  } catch (error) {
    logError(error, {
      source: "mysqlClient.listTables",
      message: `Failed to list tables for ${database} on connection ${connectionId}`
    });
    throw error;
  }
}

export async function mysqlDescribeTable(
  connectionId: string,
  database: string,
  table: string
): Promise<ColumnMeta[]> {
  await requireWails();
  try {
    return await invoke<ColumnMeta[]>("mysql_describe_table", {
      connectionId,
      database,
      table,
    });
  } catch (error) {
    logError(error, {
      source: "mysqlClient.describeTable",
      message: `Failed to describe table ${database}.${table} on connection ${connectionId}`
    });
    throw error;
  }
}
