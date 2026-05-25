import { useTranslation } from "react-i18next";

interface SqlExecutionModalProps {
  isOpen: boolean;
  value: string;
  result: string;
  loading: boolean;
  onValueChange: (value: string) => void;
  onClose: () => void;
  onExecute: () => void;
}

export function SqlExecutionModal({
  isOpen,
  value,
  result,
  loading,
  onValueChange,
  onClose,
  onExecute,
}: SqlExecutionModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="card modal-card modal-card-xl modal-card-scroll">
        <div className="card-header page-section-header">
          <h3 className="card-title">{t("mysql.tableManager.executeSql")}</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>{t("common.close")}</button>
        </div>
        <div className="modal-card-body modal-card-body-scroll">
          <textarea
            className="json-editor json-editor-sm"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            spellCheck={false}
          />
          {result && <div className="tm-sql-result">{result}</div>}
        </div>
        <div className="modal-card-footer">
          <button className="btn btn-sm btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn btn-sm btn-primary" onClick={onExecute} disabled={loading}>
            {loading ? t("common.loading") : t("mysql.query.execute")}
          </button>
        </div>
      </div>
    </div>
  );
}
