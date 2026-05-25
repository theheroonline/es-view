import { logError } from "../../../lib/errorLog";
import { selectEsTransport } from "../../../lib/transport/es/selectEsTransport";
import type { EsConnection } from "../types";
import type { EsTransportAuth, EsTransportRequest } from "./transport";

function extractCredentials(baseUrl: string) {
  try {
    const url = new URL(baseUrl);
    if (url.username || url.password) {
      const username = decodeURIComponent(url.username);
      const password = decodeURIComponent(url.password);
      url.username = "";
      url.password = "";
      return { baseUrl: url.toString().replace(/\/$/, ""), username, password };
    }
  } catch (error) {
    logError(error, {
      source: "esClient.extractCredentials",
      message: `Failed to parse Elasticsearch URL ${baseUrl}`
    });
  }
  return null;
}

function buildTransportAuth(connection: EsConnection): EsTransportAuth | undefined {
  if (connection.authType === "basic" && connection.username && connection.password) {
    return {
      authType: connection.authType,
      username: connection.username,
      password: connection.password,
    };
  }
  if (connection.authType === "apiKey" && connection.apiKey) {
    return {
      authType: connection.authType,
      apiKey: connection.apiKey,
    };
  }
  if (connection.authType === "none") {
    return {
      authType: connection.authType,
    };
  }
  return undefined;
}

function normalizeConnection(connection: EsConnection): EsConnection {
  if (connection.authType === "none") {
    const extracted = extractCredentials(connection.baseUrl);
    if (extracted) {
      return {
        ...connection,
        baseUrl: extracted.baseUrl,
        authType: "basic",
        username: extracted.username,
        password: extracted.password
      };
    }
  }
  return connection;
}

function normalizeBaseUrl(baseUrl: string): string | null {
  const trimmed = baseUrl.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    return url.origin;
  } catch (error) {
    logError(error, {
      source: "esClient.normalizeBaseUrl",
      message: `Failed to normalize Elasticsearch base URL ${baseUrl}`
    });
    return null;
  }
}

function buildTransportRequest(
  connection: EsConnection,
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): EsTransportRequest {
  const normalized = normalizeConnection(connection);
  const targetBaseUrl = normalizeBaseUrl(normalized.baseUrl);
  if (!targetBaseUrl) {
    throw new Error("CONNECTION_FAILED");
  }

  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
  };

  let body: string | undefined;
  if (options.body !== undefined) {
    if (typeof options.body === "string") {
      body = options.body;
      if (!headers["Content-Type"]) {
        headers["Content-Type"] = "text/plain";
      }
    } else {
      body = JSON.stringify(options.body);
      if (!headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
    }
  } else if (!headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  return {
    targetBaseUrl,
    requestPath: `/${path.replace(/^\//, "")}`,
    method: options.method ?? "GET",
    headers,
    body,
    verifyTls: normalized.verifyTls ?? true,
    auth: buildTransportAuth(normalized),
  };
}

export async function esRequest<T>(
  connection: EsConnection,
  path: string,
  options: { method?: string; body?: unknown } = {}
) {
  try {
    const request = buildTransportRequest(connection, path, options);
    const res = await selectEsTransport().request(request);

    if (!res.ok) {
      throw new Error(res.body || `请求失败: ${res.status}`);
    }

    return JSON.parse(res.body) as T;
  } catch (error) {
    logError(error, {
      source: "esClient.esRequest",
      message: `Elasticsearch request failed: ${options.method ?? "GET"} ${path}`,
      detail: {
        connectionId: connection.id,
        connectionName: connection.name
      }
    });
    throw error;
  }
}

export async function esRequestRaw(
  connection: EsConnection,
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<{ status: number; ok: boolean; body: string }> {
  try {
    const request = buildTransportRequest(connection, path, options);
    return await selectEsTransport().request(request);
  } catch (error) {
    logError(error, {
      source: "esClient.esRequestRaw",
      message: `Elasticsearch raw request failed: ${options.method ?? "GET"} ${path}`,
      detail: {
        connectionId: connection.id,
        connectionName: connection.name
      }
    });
    throw error;
  }
}
