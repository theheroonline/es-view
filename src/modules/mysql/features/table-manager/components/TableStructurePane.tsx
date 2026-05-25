import type { ColumnMeta } from "../../../types";
import type { TableInfo } from "../utils";
import { StructureTabPanel } from "./StructureTabPanel";

export interface TableStructurePaneProps {
  selectedTableInfo: TableInfo | null;
  onAddColumn: () => void;
  onManageIndexes: () => void;
  onMoveColumn: (column: ColumnMeta, direction: "up" | "down") => void | Promise<void>;
  onEditColumn: (column: ColumnMeta) => void;
  onDropColumn: (column: ColumnMeta) => void | Promise<void>;
}

export function TableStructurePane({
  selectedTableInfo,
  onAddColumn,
  onManageIndexes,
  onMoveColumn,
  onEditColumn,
  onDropColumn,
}: TableStructurePaneProps) {
  return (
    <StructureTabPanel
      selectedTableInfo={selectedTableInfo}
      onAddColumn={onAddColumn}
      onManageIndexes={onManageIndexes}
      onMoveColumn={(column, direction) => {
        void onMoveColumn(column, direction);
      }}
      onEditColumn={onEditColumn}
      onDropColumn={(column) => {
        void onDropColumn(column);
      }}
    />
  );
}