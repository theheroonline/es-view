import { useTranslation } from "react-i18next";
import type { BatchEditMode } from "../utils";

interface BatchEditModalProps {
  isOpen: boolean;
  selectedCellsCount: number;
  batchEditMode: BatchEditMode;
  batchEditValue: string;
  batchEditError: string;
  onModeChange: (mode: BatchEditMode) => void;
  onValueChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export function BatchEditModal({
  isOpen,
  selectedCellsCount,
  batchEditMode,
  batchEditValue,
  batchEditError,
  onModeChange,
  onValueChange,
  onClose,
  onSave,
}: BatchEditModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="card modal-card modal-card-md modal-card-scroll">
        <div className="card-header page-section-header">
          <h3 className="card-title">{t("mysql.tableManager.batchEditTitle", { count: selectedCellsCount })}</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
        <div className="modal-card-body modal-card-grid">
          <div>
            <label>{t("mysql.tableManager.batchEditMode")}</label>
            <select
              className="form-control"
              value={batchEditMode}
              onChange={(event) => onModeChange(event.target.value as BatchEditMode)}
            >
              <option value="text">{t("mysql.tableManager.batchEditUseText")}</option>
              <option value="null">{t("mysql.tableManager.batchEditUseNull")}</option>
              <option value="empty">{t("mysql.tableManager.batchEditUseEmptyString")}</option>
            </select>
          </div>
          <div>
            <label>{t("mysql.tableManager.batchEditValue")}</label>
            <textarea
              className="json-editor json-editor-sm"
              disabled={batchEditMode !== "text"}
              value={batchEditValue}
              onChange={(event) => onValueChange(event.target.value)}
            />
          </div>
          {batchEditError && <div className="text-danger">{batchEditError}</div>}
        </div>
        <div className="modal-card-footer">
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-sm btn-primary" onClick={onSave}>
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
