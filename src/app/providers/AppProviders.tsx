import type { ReactNode } from "react";
import { ElasticsearchProvider } from "../../state/ElasticsearchContext";
import { MysqlProvider } from "../../state/MysqlContext";
import { RedisProvider } from "../../state/RedisContext";
import { SharedConnectionStateProvider } from "../../state/SharedConnectionState";

interface AppProvidersProps {
  children: ReactNode;
}

export default function AppProviders({ children }: AppProvidersProps) {
  return (
    <SharedConnectionStateProvider>
      <ElasticsearchProvider>
        <MysqlProvider>
          <RedisProvider>{children}</RedisProvider>
        </MysqlProvider>
      </ElasticsearchProvider>
    </SharedConnectionStateProvider>
  );
}