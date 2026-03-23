import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RestConsole from "../pages/RestConsole";
import { executeEsRawRequest } from "../services/restConsoleService";
import type { EsConnection } from "../types";

const esRequestRawMock = vi.hoisted(() => vi.fn());

vi.mock("../services/client", () => ({
  esRequestRaw: (...args: unknown[]) => esRequestRawMock(...args),
}));

const activeConnection: EsConnection = {
  id: "es-1",
  name: "local-es",
  engine: "elasticsearch",
  baseUrl: "http://elastic.local:9200",
  authType: "none",
  verifyTls: true,
};

vi.mock("../../../state/ElasticsearchContext", () => ({
  useElasticsearchContext: () => ({
    activeConnection,
  }),
}));

vi.mock("antd", () => ({
  Modal: {
    confirm: vi.fn(),
  },
}));

describe("RestConsole request flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("delegates executeEsRawRequest to esRequestRaw", async () => {
    esRequestRawMock.mockResolvedValueOnce({ status: 200, ok: true, body: "{}" });

    await executeEsRawRequest(activeConnection, "/_cluster/health", { method: "GET" });

    expect(esRequestRawMock).toHaveBeenCalledWith(activeConnection, "/_cluster/health", { method: "GET" });
  });

  it("executes parsed batch commands through the REST console service chain", async () => {
    esRequestRawMock
      .mockResolvedValueOnce({ status: 200, ok: true, body: '{"status":"green"}' })
      .mockResolvedValueOnce({ status: 201, ok: true, body: '{"hits":{"total":1}}' });

    render(<RestConsole />);

    fireEvent.click(screen.getByLabelText("restConsole.batchMode"));
    fireEvent.change(screen.getByPlaceholderText("restConsole.batchPlaceholder"), {
      target: {
        value: [
          "GET /_cluster/health",
          "",
          "POST /logs/_search",
          '{"query":{"match_all":{}}}',
        ].join("\n"),
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "restConsole.execute" }));

    await waitFor(() => {
      expect(esRequestRawMock).toHaveBeenCalledTimes(2);
    });

    expect(esRequestRawMock).toHaveBeenNthCalledWith(1, activeConnection, "/_cluster/health", {
      method: "GET",
      body: undefined,
    });
    expect(esRequestRawMock).toHaveBeenNthCalledWith(2, activeConnection, "/logs/_search", {
      method: "POST",
      body: { query: { match_all: {} } },
    });

    expect(await screen.findByText("#1 GET /_cluster/health")).toBeInTheDocument();
    expect(screen.getByText("2/2")).toBeInTheDocument();
    expect(screen.getByText(/"status": "green"/)).toBeInTheDocument();
  });
});