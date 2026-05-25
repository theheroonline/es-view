import { useCallback } from "react";
import { logError } from "../../../../../lib/errorLog";
import { executeTableDataQuery } from "../services/tableDataService";

interface UseTableSqlExecutionProps {
  connectionId: string | null | undefined;
  sqlModalValue: string;
  selectedDatabase: string | undefined;
  refreshDatabases: () => Promise<void>;
  refreshTablesForDb: (db: string) => Promise<void>;
  setSqlModalLoading: (loading: boolean) => void;
  setSqlModalResult: (result: string) => void;
}

export function useTableSqlExecution({
  connectionId,
  sqlModalValue,
  selectedDatabase,
  refreshDatabases,
  refreshTablesForDb,
  setSqlModalLoading,
  setSqlModalResult,
}: UseTableSqlExecutionProps) {
  const executeSqlModal = useCallback(async () => {
    if (!connectionId || !sqlModalValue.trim()) return;
    setSqlModalLoading(true);
    setSqlModalResult("");

    try {
      const res = await executeTableDataQuery(connectionId, sqlModalValue.trim());
      if (res.isResultSet) {
        setSqlModalResult(`Result: ${res.rows.length} rows returned`);
      } else {
        setSqlModalResult(`Done. Affected rows: ${res.affectedRows}`);
      }
      await refreshDatabases();
      if (selectedDatabase) {
        await refreshTablesForDb(selectedDatabase);
      }
    } catch (err) {
      logError(err, {
        source: "useTableSqlExecution.execute",
        message: "Failed to execute SQL from MySQL table manager modal"
      });
      setSqlModalResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSqlModalLoading(false);
    }
  }, [connectionId, refreshDatabases, refreshTablesForDb, selectedDatabase, setSqlModalLoading, setSqlModalResult, sqlModalValue]);

  return { executeSqlModal };
}
