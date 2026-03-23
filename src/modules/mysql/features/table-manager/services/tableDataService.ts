import type { MysqlQueryResult } from "../../../types";
import { mysqlQuery } from "../../../services/queryClient";

export async function executeTableDataQuery(connectionId: string, sql: string): Promise<MysqlQueryResult> {
  return mysqlQuery(connectionId, sql);
}

export async function fetchTablePage(
  connectionId: string,
  database: string,
  table: string,
  page: number,
  pageSize: number,
  whereClause: string,
  orderClause: string
): Promise<{ total: number; dataResult: MysqlQueryResult }> {
  const offset = (page - 1) * pageSize;
  const countResult = await mysqlQuery(
    connectionId,
    `SELECT COUNT(*) as cnt FROM \`${database}\`.\`${table}\`${whereClause}`
  );
  const total = countResult.isResultSet && countResult.rows.length > 0
    ? Number(countResult.rows[0][0]) || 0
    : 0;

  const dataResult = await mysqlQuery(
    connectionId,
    `SELECT * FROM \`${database}\`.\`${table}\`${whereClause}${orderClause} LIMIT ${offset}, ${pageSize}`
  );

  return { total, dataResult };
}