import { mysqlExportTable, mysqlExportTables, mysqlImportSql } from "../../../services/transferClient";

export async function exportTableSql(connectionId: string, database: string, table: string, includeData: boolean): Promise<string> {
  return mysqlExportTable(connectionId, database, table, includeData);
}

export async function exportSelectedTablesSql(
  connectionId: string,
  database: string,
  tables: string[],
  includeData: boolean,
): Promise<string> {
  return mysqlExportTables(connectionId, database, tables, includeData);
}

export async function importTableSql(connectionId: string, database?: string, table?: string): Promise<string> {
  return mysqlImportSql(connectionId, database, table);
}