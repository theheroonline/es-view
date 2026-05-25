import type { EsTransport, EsTransportRequest, EsTransportResponse } from "../../../modules/es/services/transport";
import { invokeDesktop } from "./invokeDesktop";

export const esDesktopTransport: EsTransport = {
  async request(request: EsTransportRequest): Promise<EsTransportResponse> {
    const result = await invokeDesktop<string | EsTransportResponse>("http_request", {
      url: `${request.targetBaseUrl}${request.requestPath}`,
      method: request.method,
      headers: request.headers,
      body: request.body,
      verifyTls: request.verifyTls,
      auth: request.auth,
      // TLS
      tlsMode: request.tlsMode,
      tlsCaCertPath: request.tlsCaCertPath,
      tlsCaCertPem: request.tlsCaCertPem,
      tlsClientCertPath: request.tlsClientCertPath,
      tlsClientCertPem: request.tlsClientCertPem,
      tlsClientKeyPath: request.tlsClientKeyPath,
      tlsClientKeyPem: request.tlsClientKeyPem,
    }, {
      featureName: "Elasticsearch desktop transport",
      errorMessage: "Elasticsearch desktop request failed",
    });

    const response = typeof result === "string" ? JSON.parse(result) : result;
    return {
      status: response.status,
      ok: response.ok,
      body: response.body,
    };
  },
};