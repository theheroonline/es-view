import type { ReactNode } from "react";
import { composeProviders } from "../../lib/composeProviders";
import { ElasticsearchProvider } from "../../state/ElasticsearchContext";
import { MysqlProvider } from "../../state/MysqlContext";
import { RedisProvider } from "../../state/RedisContext";
import { SharedConnectionStateProvider } from "../../state/SharedConnectionState";

interface AppProvidersProps {
  children: ReactNode;
}

const ComposedProviders = composeProviders(
  SharedConnectionStateProvider,
  ElasticsearchProvider,
  MysqlProvider,
  RedisProvider
);

export default function AppProviders({ children }: AppProvidersProps) {
  return <ComposedProviders>{children}</ComposedProviders>;
}