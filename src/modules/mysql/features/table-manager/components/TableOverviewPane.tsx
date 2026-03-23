import type { DragEvent, MouseEvent } from "react";
import { DatabaseOverviewPanel } from "./DatabaseOverviewPanel";

export interface TableOverviewPaneProps {
  expandedDatabase: string | null;
  tables: string[];
  selectedTable?: string | null;
  selectedOverviewTables: string[];
  loading: boolean;
  onTableClick: (event: MouseEvent<HTMLDivElement>, database: string, table: string) => void;
  onClearSelection: () => void;
  onBrowseTable: (database: string, table: string) => void;
  onTableDragStart: (event: DragEvent<HTMLDivElement>, database: string, table: string) => void;
  onTableContextMenu: (event: MouseEvent<HTMLDivElement>, database: string, table: string) => void;
  onRefreshTables: (database: string) => void | Promise<void>;
  onOpenCreateTable: () => void;
}

export function TableOverviewPane({
  expandedDatabase,
  tables,
  selectedTable,
  selectedOverviewTables,
  loading,
  onTableClick,
  onClearSelection,
  onBrowseTable,
  onTableDragStart,
  onTableContextMenu,
  onRefreshTables,
  onOpenCreateTable,
}: TableOverviewPaneProps) {
  return (
    <DatabaseOverviewPanel
      expandedDatabase={expandedDatabase}
      tables={tables}
      selectedTable={selectedTable}
      selectedOverviewTables={selectedOverviewTables}
      loading={loading}
      onTableClick={onTableClick}
      onClearSelection={onClearSelection}
      onBrowseTable={onBrowseTable}
      onTableDragStart={onTableDragStart}
      onTableContextMenu={onTableContextMenu}
      onRefreshTables={(database) => {
        void onRefreshTables(database);
      }}
      onCreateTableClick={() => onOpenCreateTable()}
    />
  );
}