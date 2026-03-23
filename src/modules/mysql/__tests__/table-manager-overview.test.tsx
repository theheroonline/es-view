import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TableOverviewPane } from "../features/table-manager/components/TableOverviewPane";

describe("TableOverviewPane", () => {
  it("wires overview actions through to the panel", () => {
    const onTableClick = vi.fn();
    const onClearSelection = vi.fn();
    const onBrowseTable = vi.fn();
    const onTableDragStart = vi.fn();
    const onTableContextMenu = vi.fn();
    const onRefreshTables = vi.fn();
    const onOpenCreateTable = vi.fn();

    render(
      <TableOverviewPane
        expandedDatabase="app_db"
        tables={["users", "orders"]}
        selectedTable="users"
        selectedOverviewTables={["users"]}
        loading={false}
        onTableClick={onTableClick}
        onClearSelection={onClearSelection}
        onBrowseTable={onBrowseTable}
        onTableDragStart={onTableDragStart}
        onTableContextMenu={onTableContextMenu}
        onRefreshTables={onRefreshTables}
        onOpenCreateTable={onOpenCreateTable}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "mysql.tableManager.clearTableSelection" }));
    fireEvent.click(screen.getByRole("button", { name: "mysql.tableManager.refreshTables" }));
    fireEvent.click(screen.getByRole("button", { name: "mysql.tableManager.createTable" }));
    fireEvent.click(screen.getByText("users"));
    fireEvent.doubleClick(screen.getByText("users"));
    fireEvent.contextMenu(screen.getByText("users"));

    expect(onClearSelection).toHaveBeenCalledTimes(1);
    expect(onRefreshTables).toHaveBeenCalledWith("app_db");
    expect(onOpenCreateTable).toHaveBeenCalledTimes(1);
    expect(onTableClick).toHaveBeenCalled();
    expect(onBrowseTable).toHaveBeenCalledWith("app_db", "users");
    expect(onTableContextMenu).toHaveBeenCalled();
  });

  it("shows the open database hint when no database is expanded", () => {
    render(
      <TableOverviewPane
        expandedDatabase={null}
        tables={[]}
        selectedTable={null}
        selectedOverviewTables={[]}
        loading={false}
        onTableClick={vi.fn()}
        onClearSelection={vi.fn()}
        onBrowseTable={vi.fn()}
        onTableDragStart={vi.fn()}
        onTableContextMenu={vi.fn()}
        onRefreshTables={vi.fn()}
        onOpenCreateTable={vi.fn()}
      />
    );

    expect(screen.getByText("mysql.tableManager.openDatabaseHint")).toBeInTheDocument();
  });
});