import type { TFunction } from "i18next";
import type { RedisDatabaseInfo, RedisKeyDetail, RedisKeySummary } from "../../types";

export type RedisBrowserEditorMode = "create" | "edit";

export interface RedisBrowserState {
  databases: RedisDatabaseInfo[];
  keyPattern: string;
  scannedKeys: RedisKeySummary[];
  nextCursor: string;
  hasMoreKeys: boolean;
  selectedKey: string | null;
  selectedKeyDetail: RedisKeyDetail | null;
  error: string;
}

export interface RedisBrowserListPaneProps {
  currentDatabase: number;
  databaseOptions: RedisDatabaseInfo[];
  error: string;
  hasMoreKeys: boolean;
  keyPattern: string;
  loadingKeys: boolean;
  scanCount: number;
  scannedKeys: RedisKeySummary[];
  selectedKey: string | null;
  t: TFunction;
  onChangeDatabase: (database: number) => void;
  onChangePattern: (pattern: string) => void;
  onChangeScanCount: (value: number) => void;
  onCreateKey: () => void;
  onLoadKeys: (reset: boolean) => void;
  onSelectKey: (key: string) => void;
}

export interface RedisBrowserDetailPaneProps {
  loadingDetail: boolean;
  selectedKey: string | null;
  selectedKeyDetail: RedisKeyDetail | null;
  t: TFunction;
  ttlButtonValue: number;
  onDeleteKey: (keys: string[]) => void;
  onEditKey: () => void;
  onOpenTtl: () => void;
}
