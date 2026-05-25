import { useTranslation } from "react-i18next";

interface SortDraft {
  column: string;
  direction: "asc" | "desc";
}

interface SortDataModalProps {
  isOpen: boolean;
  columns: string[];
  draft: SortDraft;
  onDraftChange: (updater: (previous: SortDraft) => SortDraft) => void;
  onClose: () => void;
  onClear: () => void;
  onApply: (column: string, direction: "asc" | "desc") => void;
}

export function SortDataModal({
  isOpen,
  columns,
  draft,
  onDraftChange,
  onClose,
  onClear,
  onApply,
}: SortDataModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="card modal-card modal-card-sm">
        <div className="card-header page-section-header">
          <h3 className="card-title">{t("mysql.tableManager.sortData")}</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>{t("common.close")}</button>
        </div>
        <div className="modal-card-body modal-card-grid">
          <div>
            <label>{t("mysql.tableManager.sortColumn")}</label>
            <select
              className="form-control"
              value={draft.column}
              onChange={(event) => onDraftChange((previous) => ({ ...previous, column: event.target.value }))}
            >
              {columns.map((column) => (
                <option key={column} value={column}>{column}</option>
              ))}
            </select>
          </div>
          <div>
            <label>{t("mysql.tableManager.sortDirection")}</label>
            <select
              className="form-control"
              value={draft.direction}
              onChange={(event) => onDraftChange((previous) => ({ ...previous, direction: event.target.value as "asc" | "desc" }))}
            >
              <option value="asc">{t("dataBrowser.sortAscending")}</option>
              <option value="desc">{t("dataBrowser.sortDescending")}</option>
            </select>
          </div>
        </div>
        <div className="modal-card-footer">
          <button className="btn btn-sm btn-ghost" onClick={onClear}>{t("mysql.tableManager.clearSort")}</button>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn btn-sm btn-primary" onClick={() => onApply(draft.column, draft.direction)}>{t("common.save")}</button>
        </div>
      </div>
    </div>
  );
}
