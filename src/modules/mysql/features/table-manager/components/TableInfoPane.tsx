import type { TableInfo } from "../utils";
import { InfoTabPanel } from "./InfoTabPanel";

export interface TableInfoPaneProps {
  selectedTableInfo: TableInfo | null;
}

export function TableInfoPane({ selectedTableInfo }: TableInfoPaneProps) {
  return <InfoTabPanel selectedTableInfo={selectedTableInfo} />;
}