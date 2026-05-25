import type { EsTransport, EsTransportRequest, EsTransportResponse } from "../../../modules/es/services/transport";
import { buildBrowserEsAuthHeader } from "../../../modules/es/services/transport";
import { requestHttp } from "./requestHttp";

export const esHttpTransport: EsTransport = {
  async request(request: EsTransportRequest): Promise<EsTransportResponse> {
    const headers: Record<string, string> = {
      ...request.headers,
      "x-es-target": request.targetBaseUrl,
    };

    const authHeader = buildBrowserEsAuthHeader(request.auth);
    if (authHeader) {
      headers.Authorization = authHeader;
    }

    return requestHttp(`/es${request.requestPath}`, {
      method: request.method,
      headers,
      body: request.body,
    });
  },
};