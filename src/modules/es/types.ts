import type { AuthType, EngineType, SshTunnelConfig } from "../../lib/types";

export interface EsConnection {
  id: string;
  name: string;
  engine: EngineType;
  baseUrl: string;
  authType: AuthType;
  username?: string;
  password?: string;
  apiKey?: string;
  verifyTls: boolean;
  ssh?: SshTunnelConfig;
  sshPassword?: string;
  // TLS
  tlsMode?: string;
  tlsCaCertPath?: string;
  tlsClientCertPath?: string;
  tlsClientKeyPath?: string;
  // Environment type
  connectionType?: "development" | "test" | "production";
}

export interface IndexMeta {
  index: string;
  health?: string;
  docsCount?: string;
}
