import { describe, expect, it, vi } from "vitest";
import { executeEsSqlSelect } from "../services/sqlService";
import type { EsConnection } from "../types";

const searchEsDocumentsMock = vi.hoisted(() => vi.fn());

vi.mock("../services/searchService", () => ({
  searchEsDocuments: (...args: unknown[]) => searchEsDocumentsMock(...args),
}));

const baseConnection: EsConnection = {
  id: "es-1",
  name: "local-es",
  engine: "elasticsearch",
  baseUrl: "http://elastic.local:9200",
  authType: "none",
  verifyTls: true,
};

describe("sqlService.executeEsSqlSelect", () => {
  it("extracts columns from hits when availableFields is empty", async () => {
    searchEsDocumentsMock.mockResolvedValueOnce({
      hits: {
        hits: [
          { _source: { level: "info", host: "api-1" } },
          { _source: { level: "error", host: "api-2" } },
        ],
      },
    });

    const result = await executeEsSqlSelect(
      baseConnection,
      "logs",
      { query: { match_all: {} } },
      [],
      { enabled: false, fields: [] },
    );

    expect(searchEsDocumentsMock).toHaveBeenCalledWith(baseConnection, "logs", { query: { match_all: {} } });
    expect(result.totalRows).toBe(2);
    expect(result.result.columns).toEqual(expect.arrayContaining(["level", "host"]));
    expect(result.result.rows).toHaveLength(2);
  });

  it("projects only selected fields when field filter is enabled", async () => {
    searchEsDocumentsMock.mockResolvedValueOnce({
      hits: {
        hits: [
          { _source: { timestamp: "2026-03-23T12:00:00Z", level: "warn", host: "api-1" } },
        ],
      },
    });

    const result = await executeEsSqlSelect(
      baseConnection,
      "logs",
      { query: { term: { level: "warn" } } },
      ["timestamp", "level", "host"],
      { enabled: true, fields: ["host", "level"] },
    );

    expect(result.totalRows).toBe(1);
    expect(result.result.columns).toEqual(["host", "level"]);
    expect(result.result.rows).toEqual([["api-1", "warn"]]);
  });
});