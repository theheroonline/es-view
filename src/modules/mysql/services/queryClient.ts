import { logError } from "../../../lib/errorLog";
import type { MysqlQueryResult } from "../types";
import { invokeMysql, requireMysqlDesktopMode } from "./runtime";

export async function mysqlQuery(connectionId: string, sql: string): Promise<MysqlQueryResult> {
  await requireMysqlDesktopMode();
  try {
    return await invokeMysql<MysqlQueryResult>("mysql_query", { connectionId, sql });
  } catch (error) {
    logError(error, {
      source: "mysqlClient.query",
      message: `Failed to execute MySQL query on connection ${connectionId}`,
      detail: sql
    });
    throw error;
  }
}

export async function mysqlListDatabases(connectionId: string): Promise<string[]> {
  await requireMysqlDesktopMode();
  try {
    return await invokeMysql<string[]>("mysql_list_databases", { connectionId });
  } catch (error) {
    logError(error, {
      source: "mysqlClient.listDatabases",
      message: `Failed to list MySQL databases for connection ${connectionId}`
    });
    throw error;
  }
}

export async function mysqlListTables(connectionId: string, database: string): Promise<string[]> {
  await requireMysqlDesktopMode();
  try {
    return await invokeMysql<string[]>("mysql_list_tables", { connectionId, database });
  } catch (error) {
    logError(error, {
      source: "mysqlClient.listTables",
      message: `Failed to list tables for ${database} on connection ${connectionId}`
    });
    throw error;
  }
}