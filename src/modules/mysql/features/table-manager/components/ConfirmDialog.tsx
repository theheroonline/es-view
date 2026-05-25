import { useTranslation } from "react-i18next";

interface ConfirmDialogState {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  isDangerous?: boolean;
}

interface ConfirmDialogProps {
  dialog: ConfirmDialogState;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  dialog,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useTranslation();

  if (!dialog.open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="card modal-card modal-card-md" onClick={(event) => event.stopPropagation()}>
        <div className="card-header page-section-header">
          <h3 className="card-title">{dialog.title}</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
        <div className="modal-card-body">
          <p>{dialog.message}</p>
        </div>
        <div className="modal-card-footer">
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            className={`btn btn-sm ${dialog.isDangerous ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
          >
            {t("common.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
