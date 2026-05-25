import { useTranslation } from "react-i18next";
import type { RightPanelTab } from "../utils";
import { TableDataPane } from "./TableDataPane";
import { TableInfoPane } from "./TableInfoPane";
import { TableOverviewPane, type TableOverviewPaneProps } from "./TableOverviewPane";
import { TableStructurePane } from "./TableStructurePane";
import type { TableDataPaneProps } from "./TableDataPane";
import type { TableStructurePaneProps } from "./TableStructurePane";
import type { TableInfoPaneProps } from "./TableInfoPane";

export interface TableManagerWorkspaceProps {
  isTableWorkspace: boolean;
  activeOpenedTable: { database: string; table: string } | null;
  rightPanelTab: RightPanelTab;
  overviewPaneProps: TableOverviewPaneProps;
  dataPaneProps: TableDataPaneProps;
  structurePaneProps: TableStructurePaneProps;
  infoPaneProps: TableInfoPaneProps;
  toolbarActions?: React.ReactNode;
}

export function TableManagerWorkspace({
  isTableWorkspace,
  activeOpenedTable,
  rightPanelTab,
  overviewPaneProps,
  dataPaneProps,
  structurePaneProps,
  infoPaneProps,
  toolbarActions,
}: TableManagerWorkspaceProps) {
  const { t } = useTranslation();

  if (!isTableWorkspace) {
    return <TableOverviewPane {...overviewPaneProps} />;
  }

  if (!activeOpenedTable) {
    return (
      <div className="workspace-center-state">
        <span className="muted">{t("mysql.tableManager.selectTableHint")}</span>
      </div>
    );
  }

  return (
    <>
      <div className="tm-tab-panel">
        <div className="mysql-tab-content-wrap">
          <div className="mysql-tab-pane" data-active={rightPanelTab === "data"}>
            {toolbarActions}
            <TableDataPane {...dataPaneProps} />
          </div>
          <div className="mysql-tab-pane" data-active={rightPanelTab === "structure"}>
            <TableStructurePane {...structurePaneProps} />
          </div>
          <div className="mysql-tab-pane" data-active={rightPanelTab === "info"}>
            <TableInfoPane {...infoPaneProps} />
          </div>
        </div>
      </div>
    </>
  );
}
