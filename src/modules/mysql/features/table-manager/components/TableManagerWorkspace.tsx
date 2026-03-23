import { useTranslation } from "react-i18next";
import type { RightPanelTab } from "../utils";
import { TableDataPane, type TableDataPaneProps } from "./TableDataPane";
import { TableInfoPane, type TableInfoPaneProps } from "./TableInfoPane";
import { TableOverviewPane, type TableOverviewPaneProps } from "./TableOverviewPane";
import { TableStructurePane, type TableStructurePaneProps } from "./TableStructurePane";

export interface TableManagerWorkspaceProps {
  isTableWorkspace: boolean;
  activeOpenedTable: { database: string; table: string } | null;
  rightPanelTab: RightPanelTab;
  onSelectTab: (tab: RightPanelTab) => void;
  overviewPaneProps: TableOverviewPaneProps;
  dataPaneProps: TableDataPaneProps;
  structurePaneProps: TableStructurePaneProps;
  infoPaneProps: TableInfoPaneProps;
}

export function TableManagerWorkspace({
  isTableWorkspace,
  activeOpenedTable,
  rightPanelTab,
  onSelectTab,
  overviewPaneProps,
  dataPaneProps,
  structurePaneProps,
  infoPaneProps,
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
      <div className="tm-tab-strip">
        <div className="tm-tab-buttons">
          <button
            className={`btn btn-sm tm-tab-button ${rightPanelTab === "data" ? "btn-primary is-active" : "btn-ghost"}`}
            onClick={() => onSelectTab("data")}
          >
            {t("mysql.tableManager.data")}
          </button>
          <button
            className={`btn btn-sm tm-tab-button ${rightPanelTab === "structure" ? "btn-primary is-active" : "btn-ghost"}`}
            onClick={() => onSelectTab("structure")}
          >
            {t("mysql.tableManager.structure")}
          </button>
          <button
            className={`btn btn-sm tm-tab-button ${rightPanelTab === "info" ? "btn-primary is-active" : "btn-ghost"}`}
            onClick={() => onSelectTab("info")}
          >
            {t("mysql.tableManager.info")}
          </button>
        </div>
      </div>

      <div className="tm-tab-panel">
        {rightPanelTab === "data" ? (
          <TableDataPane {...dataPaneProps} />
        ) : rightPanelTab === "info" ? (
          <TableInfoPane {...infoPaneProps} />
        ) : (
          <TableStructurePane {...structurePaneProps} />
        )}
      </div>
    </>
  );
}