import { Input } from "antd";
import { useTranslation } from "react-i18next";

interface CopyTableDialogState {
  open: boolean;
  db: string;
  table: string;
  nextName: string;
}

interface CopyTableDialogProps {
  dialog: CopyTableDialogState;
  onClose: () => void;
  onNextNameChange: (nextName: string) => void;
  onConfirm: () => void;
}

export function CopyTableDialog({
  dialog,
  onClose,
  onNextNameChange,
  onConfirm,
}: CopyTableDialogProps) {
  const { t } = useTranslation();

  if (!dialog.open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="card modal-card modal-card-sm" onClick={(event) => event.stopPropagation()}>
        <div className="card-header page-section-header">
          <h3 className="card-title">{t("mysql.tableManager.copyTable")}</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
        <div className="modal-card-body modal-card-grid">
          <label>{t("mysql.tableManager.copyTablePrompt")}</label>
          <Input
            value={dialog.nextName}
            onChange={(event) => onNextNameChange(event.target.value)}
            autoFocus
          />
        </div>
        <div className="modal-card-footer">
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-sm btn-primary" onClick={onConfirm}>
            {t("common.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
