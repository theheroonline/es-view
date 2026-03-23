import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EsConnection } from "../types";

const httpRequestMock = vi.hoisted(() => vi.fn());
const desktopRequestMock = vi.hoisted(() => vi.fn());
const isWailsMock = vi.hoisted(() => vi.fn());

vi.mock("../../../lib/transport/http/esHttpTransport", () => ({
  esHttpTransport: { request: httpRequestMock },
}));

vi.mock("../../../lib/transport/wails/esDesktopTransport", () => ({
  esDesktopTransport: { request: desktopRequestMock },
}));

vi.mock("../../../lib/wailsapi", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/wailsapi")>("../../../lib/wailsapi");
  return {
    ...actual,
    isWails: isWailsMock,
  };
});

const baseConnection: EsConnection = {
  id: "es-1",
  name: "local-es",
  engine: "elasticsearch",
  baseUrl: "elastic.local:9200",
  authType: "basic",
  username: "alice",
  password: "secret",
  verifyTls: false,
};

describe("ES service transport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses browser transport when not running inside Wails", async () => {
    isWailsMock.mockReturnValue(false);
    httpRequestMock.mockResolvedValue({ status: 200, ok: true, body: '{"ok":true}' });

    const { esRequestRaw } = await import("../services/client");

    await esRequestRaw(baseConnection, "/_cluster/health");

    expect(httpRequestMock).toHaveBeenCalledTimes(1);
    expect(desktopRequestMock).not.toHaveBeenCalled();
    expect(httpRequestMock).toHaveBeenCalledWith(expect.objectContaining({
      targetBaseUrl: "http://elastic.local:9200",
      requestPath: "/_cluster/health",
      method: "GET",
      verifyTls: false,
      auth: {
        authType: "basic",
        username: "alice",
        password: "secret",
      },
    }));
  });

  it("uses desktop transport and forwards verifyTls and auth to the request context", async () => {
    isWailsMock.mockReturnValue(true);
    desktopRequestMock.mockResolvedValue({ status: 200, ok: true, body: '{"hits":{"hits":[]}}' });

    const { esRequestRaw } = await import("../services/client");

    await esRequestRaw(baseConnection, "/logs/_search", {
      method: "POST",
      body: { query: { match_all: {} } },
    });

    expect(desktopRequestMock).toHaveBeenCalledTimes(1);
    expect(httpRequestMock).not.toHaveBeenCalled();
    expect(desktopRequestMock).toHaveBeenCalledWith(expect.objectContaining({
      targetBaseUrl: "http://elastic.local:9200",
      requestPath: "/logs/_search",
      method: "POST",
      verifyTls: false,
      body: JSON.stringify({ query: { match_all: {} } }),
      auth: {
        authType: "basic",
        username: "alice",
        password: "secret",
      },
    }));
  });

  it("adds x-es-target and Authorization headers in browser transport", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      text: vi.fn().mockResolvedValue('{"ok":true}'),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { esHttpTransport: realHttpTransport } = await vi.importActual<typeof import("../../../lib/transport/http/esHttpTransport")>(
      "../../../lib/transport/http/esHttpTransport"
    );

    await realHttpTransport.request({
      targetBaseUrl: "http://elastic.local:9200",
      requestPath: "/_cluster/health",
      method: "GET",
      headers: { "Content-Type": "application/json" },
      verifyTls: true,
      auth: {
        authType: "basic",
        username: "alice",
        password: "secret",
      },
    });

    expect(fetchMock).toHaveBeenCalledWith("/es/_cluster/health", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-es-target": "http://elastic.local:9200",
        Authorization: `Basic ${btoa("alice:secret")}`,
      },
      body: undefined,
    });
  });
});