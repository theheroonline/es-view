import { useTranslation } from "react-i18next";

interface ExportSelectionState {
  database: string;
  availableTables: string[];
  selectedTables: string[];
  includeData: boolean;
}

interface ExportSelectionModalProps {
  state: ExportSelectionState | null;
  onClose: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onIncludeDataChange: (includeData: boolean) => void;
  onToggleTable: (table: string) => void;
  onConfirm: () => void;
}

export function ExportSelectionModal({
  state,
  onClose,
  onSelectAll,
  onClearSelection,
  onIncludeDataChange,
  onToggleTable,
  onConfirm,
}: ExportSelectionModalProps) {
  const { t } = useTranslation();

  if (!state) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="card modal-card modal-card-md modal-card-scroll" onClick={(event) => event.stopPropagation()}>
        <div className="card-header page-section-header">
          <div>
            <h3 className="card-title">{t("mysql.tableManager.exportSelectedTables")}</h3>
            <p className="muted tm-modal-note">
              {t("mysql.tableManager.exportSelectionSummary", {
                database: state.database,
                count: state.selectedTables.length,
              })}
            </p>
          </div>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
        <div className="modal-card-body modal-card-body-scroll tm-export-selection-modal-body">
          <div className="tm-export-selection-hero">
            <div className="tm-export-selection-hero-main">
              <span className="tm-export-selection-badge">{state.database}</span>
              <strong>{t("mysql.tableManager.selectedTablesSummary", { count: state.selectedTables.length })}</strong>
            </div>
            <div className="tm-export-selection-hero-sub muted">
              {state.includeData
                ? t("mysql.tableManager.exportSelectedStructureAndData")
                : t("mysql.tableManager.exportSelectedStructure")}
            </div>
          </div>

          <div className="tm-export-selection-toolbar">
            <div className="tm-toolbar-actions">
              <button type="button" className="btn btn-sm btn-ghost" onClick={onSelectAll}>
                {t("mysql.tableManager.selectAllTables")}
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={onClearSelection}>
                {t("mysql.tableManager.clearSelection")}
              </button>
            </div>
            <label className="tm-checkbox-label">
              <input
                type="checkbox"
                checked={state.includeData}
                onChange={(event) => onIncludeDataChange(event.target.checked)}
              />
              <span>{t("mysql.tableManager.includeTableData")}</span>
            </label>
          </div>

          <div className="tm-export-selection-list">
            {state.availableTables.map((table) => {
              const checked = state.selectedTables.includes(table);
              return (
                <label key={table} className={`tm-export-selection-item ${checked ? "is-selected" : ""}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleTable(table)}
                  />
                  <span className="tm-export-selection-item-name">{table}</span>
                  <span className="tm-export-selection-item-meta muted">TABLE</span>
                </label>
              );
            })}
          </div>
        </div>
        <div className="modal-card-footer">
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={state.selectedTables.length === 0}
            onClick={onConfirm}
          >
            {state.includeData
              ? t("mysql.tableManager.exportSelectedStructureAndData")
              : t("mysql.tableManager.exportSelectedStructure")}
          </button>
        </div>
      </div>
    </div>
  );
}
