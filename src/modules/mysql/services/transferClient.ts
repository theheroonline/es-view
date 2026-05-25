import { logError } from "../../../lib/errorLog";
import { invokeMysql, requireMysqlDesktopMode } from "./runtime";

export async function mysqlExportDatabase(connectionId: string, database: string, includeData: boolean): Promise<string> {
  await requireMysqlDesktopMode();
  try {
    return await invokeMysql<string>("mysql_export_database", {
      connectionId,
      database,
      includeData,
    });
  } catch (error) {
    logError(error, {
      source: "mysqlClient.exportDatabase",
      message: `Failed to export database ${database}`
    });
    throw error;
  }
}

export async function mysqlExportTable(connectionId: string, database: string, table: string, includeData: boolean): Promise<string> {
  await requireMysqlDesktopMode();
  try {
    return await invokeMysql<string>("mysql_export_table", {
      connectionId,
      database,
      tableName: table,
      includeData,
    });
  } catch (error) {
    logError(error, {
      source: "mysqlClient.exportTable",
      message: `Failed to export table ${database}.${table}`
    });
    throw error;
  }
}

export async function mysqlExportTables(connectionId: string, database: string, tables: string[], includeData: boolean): Promise<string> {
  await requireMysqlDesktopMode();
  try {
    return await invokeMysql<string>("mysql_export_tables", {
      connectionId,
      database,
      tableNames: tables,
      includeData,
    });
  } catch (error) {
    logError(error, {
      source: "mysqlClient.exportTables",
      message: `Failed to export selected tables from ${database}`,
      detail: tables.join(", "),
    });
    throw error;
  }
}

export async function mysqlImportSql(connectionId: string, database?: string, table?: string): Promise<string> {
  await requireMysqlDesktopMode();
  try {
    return await invokeMysql<string>("mysql_import_sql", {
      connectionId,
      database,
      tableName: table,
    });
  } catch (error) {
    logError(error, {
      source: "mysqlClient.importSql",
      message: `Failed to import SQL${database ? ` into ${database}` : ""}`,
      detail: table ? `${database}.${table}` : database,
    });
    throw error;
  }
}