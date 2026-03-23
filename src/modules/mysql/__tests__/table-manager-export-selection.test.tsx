import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useExportImport } from "../features/table-manager/hooks/useExportImport";

const exportSelectedTablesSqlMock = vi.fn();
const exportTableSqlMock = vi.fn();
const importTableSqlMock = vi.fn();

vi.mock("../features/table-manager/services/tableExportService", () => ({
  exportSelectedTablesSql: (...args: unknown[]) => exportSelectedTablesSqlMock(...args),
  exportTableSql: (...args: unknown[]) => exportTableSqlMock(...args),
  importTableSql: (...args: unknown[]) => importTableSqlMock(...args),
}));

describe("useExportImport", () => {
  it("closes the selection modal and stores success message after exporting selected tables", async () => {
    exportSelectedTablesSqlMock.mockResolvedValueOnce("E:/exports/users.sql");

    const { result } = renderHook(() => useExportImport({ connectionId: "mysql-1", onError: vi.fn() }));

    act(() => {
      result.current.setExportSelectionModal({
        database: "app_db",
        availableTables: ["users", "orders"],
        selectedTables: ["users"],
        includeData: true,
      });
    });

    await act(async () => {
      await result.current.handleConfirmExportSelection();
    });

    expect(exportSelectedTablesSqlMock).toHaveBeenCalledWith("mysql-1", "app_db", ["users"], true);
    expect(result.current.exportSelectionModal).toBeNull();
    expect(result.current.exportSuccessMessage).toBe("E:/exports/users.sql");
  });

  it("reports errors from table export through onError", async () => {
    const onError = vi.fn();
    exportTableSqlMock.mockRejectedValueOnce(new Error("export failed"));

    const { result } = renderHook(() => useExportImport({ connectionId: "mysql-1", onError }));

    await act(async () => {
      await result.current.handleExportTableSql("app_db", "users", false);
    });

    expect(onError).toHaveBeenCalledWith("export failed");
  });
});