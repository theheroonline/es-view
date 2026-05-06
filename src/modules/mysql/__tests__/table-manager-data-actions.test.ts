import { act, renderHook } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { MysqlOpenedTable } from "../types";
import { useTableDataActions } from "../features/table-manager/hooks/useTableDataActions";
import type { DataState, FilterGroupDraft, SortDraft } from "../features/table-manager/types";

const fetchTablePageMock = vi.fn();

vi.mock("../features/table-manager/services/tableDataService", () => ({
  fetchTablePage: (...args: unknown[]) => fetchTablePageMock(...args),
}));

describe("useTableDataActions", () => {
  it("loads table data into local state via tableDataService", async () => {
    fetchTablePageMock.mockResolvedValueOnce({
      total: 2,
      dataResult: {
        columns: ["id", "name"],
        rows: [[1, "Alice"], [2, "Bob"]],
        isResultSet: true,
        affectedRows: 0,
      },
    });

    const { result } = renderHook(() => {
      const [dataState, setDataState] = useState<DataState>({
        columns: [],
        rows: [],
        total: 0,
        page: 1,
        pageSize: 100,
        loading: false,
        error: "",
      });
      const [openedTables, setOpenedTables] = useState<MysqlOpenedTable[]>([
        { database: "app_db", table: "users", view: "data", visibleColumns: ["id", "name"] },
      ]);
      const [filterDraftTree, setFilterDraftTree] = useState<FilterGroupDraft | null>(null);
      const [, setFilterPanelOpen] = useState(false);
      const [, setSortModalOpen] = useState(false);
      const [, setSortDraft] = useState<SortDraft>({ column: "", direction: "asc" });
      const latestDataRequestRef = useRef(0);
      const activeDataRequestKeyRef = useRef<string | null>(null);

      return {
        dataState,
        openedTables,
        actions: useTableDataActions({
          connectionId: "mysql-1",
          activeOpenedTable: openedTables[0] ?? null,
          selectedTableInfo: { database: "app_db", table: "users", loading: false },
          dataState,
          latestDataRequestRef,
          activeDataRequestKeyRef,
          setDataState,
          setOpenedTables,
          setFilterDraftTree,
          setFilterPanelOpen,
          setSortModalOpen,
          setSortDraft,
          filterDraftTree,
          setError: vi.fn(),
          saveTableDataCache: vi.fn(),
          dataColumnMeta: [],
        }),
      };
    });

    await act(async () => {
      await result.current.actions.fetchData();
    });

    expect(fetchTablePageMock).toHaveBeenCalledWith(
      "mysql-1",
      "app_db",
      "users",
      1,
      100,
      "",
      ""
    );
    expect(result.current.dataState.columns).toEqual(["id", "name"]);
    expect(result.current.dataState.rows).toEqual([[1, "Alice"], [2, "Bob"]]);
    expect(result.current.dataState.total).toBe(2);
  });

  it("updates opened table query state when sorting is applied", async () => {
    fetchTablePageMock.mockResolvedValueOnce({
      total: 0,
      dataResult: {
        columns: ["id"],
        rows: [],
        isResultSet: true,
        affectedRows: 0,
      },
    });

    const { result } = renderHook(() => {
      const [dataState, setDataState] = useState<DataState>({
        columns: ["id", "name"],
        rows: [],
        total: 0,
        page: 1,
        pageSize: 100,
        loading: false,
        error: "",
      });
      const [openedTables, setOpenedTables] = useState<MysqlOpenedTable[]>([
        { database: "app_db", table: "users", view: "data" },
      ]);
      const [filterDraftTree, setFilterDraftTree] = useState<FilterGroupDraft | null>(null);
      const [, setFilterPanelOpen] = useState(false);
      const [, setSortModalOpen] = useState(false);
      const [, setSortDraft] = useState<SortDraft>({ column: "", direction: "asc" });
      const latestDataRequestRef = useRef(0);
      const activeDataRequestKeyRef = useRef<string | null>(null);

      return {
        openedTables,
        actions: useTableDataActions({
          connectionId: "mysql-1",
          activeOpenedTable: openedTables[0] ?? null,
          selectedTableInfo: { database: "app_db", table: "users", loading: false },
          dataState,
          latestDataRequestRef,
          activeDataRequestKeyRef,
          setDataState,
          setOpenedTables,
          setFilterDraftTree,
          setFilterPanelOpen,
          setSortModalOpen,
          setSortDraft,
          filterDraftTree,
          setError: vi.fn(),
          saveTableDataCache: vi.fn(),
          dataColumnMeta: [],
        }),
      };
    });

    await act(async () => {
      await result.current.actions.applySort("name", "desc");
    });

    expect(result.current.openedTables[0]?.sortColumn).toBe("name");
    expect(result.current.openedTables[0]?.sortDirection).toBe("desc");
    expect(fetchTablePageMock).toHaveBeenCalledWith(
      "mysql-1",
      "app_db",
      "users",
      1,
      100,
      "",
      " ORDER BY `name` DESC"
    );
  });
});