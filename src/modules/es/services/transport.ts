export interface EsTransportAuth {
  authType: string;
  username?: string;
  password?: string;
  apiKey?: string;
}

export interface EsTransportRequest {
  targetBaseUrl: string;
  requestPath: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  verifyTls: boolean;
  auth?: EsTransportAuth;
}

export interface EsTransportResponse {
  status: number;
  ok: boolean;
  body: string;
}

export interface EsTransport {
  request(request: EsTransportRequest): Promise<EsTransportResponse>;
}

export function buildBrowserEsAuthHeader(auth?: EsTransportAuth): string | null {
  if (!auth) {
    return null;
  }
  if (auth.authType === "basic" && auth.username && auth.password) {
    const token = btoa(`${auth.username}:${auth.password}`);
    return `Basic ${token}`;
  }
  if (auth.authType === "apiKey" && auth.apiKey) {
    return `ApiKey ${auth.apiKey}`;
  }
  return null;
}