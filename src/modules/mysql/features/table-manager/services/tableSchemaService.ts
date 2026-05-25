import type { ColumnMeta, MysqlQueryResult } from "../../../types";
import { mysqlQuery } from "../../../services/queryClient";
import {
  mysqlCreateIndex,
  mysqlDescribeTable,
  mysqlDropIndex,
  mysqlListIndexes,
  type MysqlIndexMeta,
} from "../../../services/schemaClient";

export async function executeTableSchemaQuery(connectionId: string, sql: string): Promise<MysqlQueryResult> {
  return mysqlQuery(connectionId, sql);
}

export async function fetchTableDetailSnapshot(
  connectionId: string,
  database: string,
  table: string,
  escapedTableLiteral: string
): Promise<{
  columns: ColumnMeta[];
  countResult: MysqlQueryResult;
  statusResult: MysqlQueryResult;
  createResult: MysqlQueryResult;
}> {
  const [columns, countResult, statusResult, createResult] = await Promise.all([
    mysqlDescribeTable(connectionId, database, table),
    mysqlQuery(connectionId, `SELECT COUNT(*) as cnt FROM \`${database}\`.\`${table}\``),
    mysqlQuery(connectionId, `SHOW TABLE STATUS FROM \`${database}\` LIKE ${escapedTableLiteral}`),
    mysqlQuery(connectionId, `SHOW CREATE TABLE \`${database}\`.\`${table}\``)
  ]);

  return { columns, countResult, statusResult, createResult };
}

export async function listTableIndexes(connectionId: string, database: string, table: string): Promise<MysqlIndexMeta[]> {
  return mysqlListIndexes(connectionId, database, table);
}

export async function createTableIndex(
  connectionId: string,
  database: string,
  table: string,
  indexName: string,
  columns: string[],
  unique: boolean,
  indexType: string,
): Promise<string> {
  return mysqlCreateIndex(connectionId, database, table, indexName, columns, unique, indexType);
}

export async function dropTableIndex(connectionId: string, database: string, table: string, indexName: string): Promise<string> {
  return mysqlDropIndex(connectionId, database, table, indexName);
}