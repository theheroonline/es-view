import type { MysqlQueryResult } from "../../../types";
import { mysqlQuery } from "../../../services/queryClient";

export async function executeTableDataQuery(connectionId: string, sql: string): Promise<MysqlQueryResult> {
  return mysqlQuery(connectionId, sql);
}

// 格式化日期时间值，将 ISO 8601 格式转换为 MySQL datetime 格式
function formatDateTimeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  const str = String(value);
  // 检查是否是 ISO 8601 格式（包含 T 和可能的时区）
  if (str.includes("T")) {
    try {
      const date = new Date(str);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const seconds = String(date.getSeconds()).padStart(2, "0");
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      }
    } catch {
      return value;
    }
  }
  return value;
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

  // 格式化日期时间列
  if (dataResult.isResultSet && dataResult.rows.length > 0) {
    const formattedRows = dataResult.rows.map(row => {
      if (Array.isArray(row)) {
        return row.map(cell => formatDateTimeValue(cell));
      }
      return row;
    });
    return { total, dataResult: { ...dataResult, rows: formattedRows } };
  }

  return { total, dataResult };
}