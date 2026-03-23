import type { EsConnection } from "../types";
import { searchEsDocuments } from "./searchService";

export interface EsSqlFieldFilter {
  enabled: boolean;
  fields: string[];
}

export interface EsSqlTableResult {
  columns: string[];
  rows: Array<Array<unknown>>;
}

export interface EsSqlSelectResult {
  result: EsSqlTableResult;
  totalRows: number;
}

export async function executeEsSqlSelect(
  connection: EsConnection,
  index: string,
  body: unknown,
  availableFields: string[],
  fieldFilter: EsSqlFieldFilter,
): Promise<EsSqlSelectResult> {
  const response = await searchEsDocuments(connection, index, body);
  const hits = response?.hits?.hits ?? [];

  let columns = availableFields.length > 0 ? availableFields : [];
  if (columns.length === 0) {
    const colSet = new Set<string>();
    hits.forEach((hit: any) => {
      Object.keys(hit._source || {}).forEach((key) => colSet.add(key));
    });
    columns = Array.from(colSet);
  }

  const rows = hits.map((hit: any) => columns.map((col) => hit._source?.[col]));

  if (fieldFilter.enabled) {
    const filteredColumns = fieldFilter.fields.filter((f) => columns.includes(f));
    const filteredRows = rows.map((row: Array<unknown>) =>
      filteredColumns.map((col) => {
        const idx = columns.indexOf(col);
        return idx >= 0 ? row[idx] : undefined;
      })
    );

    return {
      result: { columns: filteredColumns, rows: filteredRows },
      totalRows: hits.length,
    };
  }

  return {
    result: { columns, rows },
    totalRows: hits.length,
  };
}