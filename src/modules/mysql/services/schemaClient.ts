import { logError } from "../../../lib/errorLog";
import type { ColumnMeta } from "../types";
import { invokeMysql, requireMysqlDesktopMode } from "./runtime";

export interface MysqlIndexMeta {
  name: string;
  columns: string[];
  unique: boolean;
  primary: boolean;
  indexType: string;
}

export async function mysqlDescribeTable(connectionId: string, database: string, table: string): Promise<ColumnMeta[]> {
  await requireMysqlDesktopMode();
  try {
    return await invokeMysql<ColumnMeta[]>("mysql_describe_table", {
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

export async function mysqlListIndexes(connectionId: string, database: string, table: string): Promise<MysqlIndexMeta[]> {
  await requireMysqlDesktopMode();
  try {
    return await invokeMysql<MysqlIndexMeta[]>("mysql_list_indexes", {
      connectionId,
      database,
      tableName: table,
    });
  } catch (error) {
    logError(error, {
      source: "mysqlClient.listIndexes",
      message: `Failed to list indexes for ${database}.${table} on connection ${connectionId}`
    });
    throw error;
  }
}

export async function mysqlCreateIndex(
  connectionId: string,
  database: string,
  table: string,
  indexName: string,
  columns: string[],
  unique: boolean,
  indexType: string = "BTREE"
): Promise<string> {
  await requireMysqlDesktopMode();
  try {
    return await invokeMysql<string>("mysql_create_index", {
      connectionId,
      database,
      tableName: table,
      indexName,
      columns,
      unique,
      indexType,
    });
  } catch (error) {
    logError(error, {
      source: "mysqlClient.createIndex",
      message: `Failed to create index on ${database}.${table}`
    });
    throw error;
  }
}

export async function mysqlDropIndex(connectionId: string, database: string, table: string, indexName: string): Promise<string> {
  await requireMysqlDesktopMode();
  try {
    return await invokeMysql<string>("mysql_drop_index", {
      connectionId,
      database,
      tableName: table,
      indexName,
    });
  } catch (error) {
    logError(error, {
      source: "mysqlClient.dropIndex",
      message: `Failed to drop index on ${database}.${table}`
    });
    throw error;
  }
}