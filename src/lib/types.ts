export type AuthType = "none" | "basic" | "apiKey";
export type EngineType = "elasticsearch" | "mysql" | "redis";

export interface SshTunnelConfig {
  enabled: boolean;
  host?: string;
  port?: number;
  username?: string;
  // SSH key authentication
  authMethod?: "password" | "key" | "agent";
  privateKeyPath?: string;
  privateKeyPem?: string;
  passphrase?: string;
  // Host key verification
  hostKeyMode?: "strict" | "accept-new" | "insecure";
  knownHostsPath?: string;
}

export interface SecretConfig {
  username?: string;
  password?: string;
  apiKey?: string;
  sshPassword?: string;
  sshPassphrase?: string;
  sshPrivateKeyPem?: string;
  // TLS certificates (inline PEM)
  tlsCaCertPem?: string;
  tlsClientCertPem?: string;
  tlsClientKeyPem?: string;
}

export interface ConnectionProfile {
  id: string;
  name: string;
  engine: EngineType;
  baseUrl: string;
  mysqlHost?: string;
  mysqlPort?: number;
  mysqlDatabase?: string;
  redisHost?: string;
  redisPort?: number;
  redisDatabase?: number;
  authType: AuthType;
  verifyTls: boolean;
  ssh?: SshTunnelConfig;
  // MySQL TLS (non-secret paths)
  tlsMode?: string;
  tlsCaCertPath?: string;
  tlsClientCertPath?: string;
  tlsClientKeyPath?: string;
  // Connection bootstrap
  initSql?: string;
  ignoreSqlErrors?: boolean;
  // Driver params
  driverParams?: Record<string, string>;
  // Auto-reconnect
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
  // Connection type label
  connectionType?: "development" | "test" | "production";
  // ES version (user-selected, default "7")
  esVersion?: string;
}

export interface LocalState {
  profiles: ConnectionProfile[];
  secrets: Record<string, SecretConfig>;
  lastConnectionId?: string;
}
