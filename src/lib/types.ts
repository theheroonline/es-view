export type AuthType = "none" | "basic" | "apiKey";

export interface EsConnection {
  id: string;
  name: string;
  baseUrl: string;
  authType: AuthType;
  username?: string;
  password?: string;
  apiKey?: string;
  verifyTls: boolean;
}

export interface ConnectionProfile {
  id: string;
  name: string;
  baseUrl: string;
  authType: AuthType;
  verifyTls: boolean;
}

export interface QueryHistoryItem {
  id: string;
  title: string;
  sql: string;
  createdAt: string;
}

export interface LocalState {
  profiles: ConnectionProfile[];
  secrets: Record<string, { username?: string; password?: string; apiKey?: string }>;
  history: QueryHistoryItem[];
  lastConnectionId?: string;
  selectedIndex?: string;
}
