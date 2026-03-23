import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MysqlProvider, useMysqlContext } from "../../../state/MysqlContext";

vi.mock("../../../state/SharedConnectionState", () => ({
  useSharedConnectionState: () => ({
    profiles: [
      {
        id: "mysql-1",
        name: "Primary",
        engine: "mysql",
        mysqlHost: "127.0.0.1",
        mysqlPort: 3306,
      },
    ],
    getSecretById: () => ({ username: "root", password: "root" }),
    getActiveConnectionIdByEngine: () => "mysql-1",
  }),
}));

function Consumer() {
  const { getSqlQueryState, updateSqlQueryState } = useMysqlContext();
  const state = getSqlQueryState("mysql-1");

  return (
    <div>
      <span data-testid="sql">{state.sql}</span>
      <span data-testid="results">{String(state.results.length)}</span>
      <button
        onClick={() => {
          updateSqlQueryState("mysql-1", {
            sql: "SELECT 1",
            results: [{
              id: "stmt-1",
              sql: "SELECT 1",
              effectiveSql: "SELECT 1",
              mode: "execute",
              durationMs: 1,
              connectionName: "Primary",
            }],
          });
        }}
      >
        update
      </button>
    </div>
  );
}

describe("MysqlContext sqlQueryStates", () => {
  it("returns default state before any query is stored", () => {
    render(
      <MysqlProvider>
        <Consumer />
      </MysqlProvider>
    );

    expect(screen.getByTestId("sql")).toHaveTextContent("");
    expect(screen.getByTestId("results")).toHaveTextContent("0");
  });

  it("merges and exposes stored sql query state per connection", () => {
    render(
      <MysqlProvider>
        <Consumer />
      </MysqlProvider>
    );

    act(() => {
      screen.getByRole("button", { name: "update" }).click();
    });

    expect(screen.getByTestId("sql")).toHaveTextContent("SELECT 1");
    expect(screen.getByTestId("results")).toHaveTextContent("1");
  });
});