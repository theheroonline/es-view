import { useTranslation } from "react-i18next";
import type { ColumnMeta } from "../../../types";

interface AddRowModalProps {
  isOpen: boolean;
  columns?: ColumnMeta[];
  formData: Record<string, string>;
  error: string;
  onClose: () => void;
  onSave: () => void;
  onFieldChange: (field: string, value: string) => void;
}

export function AddRowModal({
  isOpen,
  columns,
  formData,
  error,
  onClose,
  onSave,
  onFieldChange,
}: AddRowModalProps) {
  const { t } = useTranslation();

  if (!isOpen || !columns) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()} style={{ maxWidth: "500px" }}>
        <div className="modal-card-body" style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {error && (
            <div className="alert alert-danger" style={{ marginBottom: "12px" }}>
              {error}
            </div>
          )}

          <table className="form-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", fontWeight: "600", fontSize: "12px", color: "#666", paddingBottom: "8px" }}>
                  {t("mysql.tableManager.columnName")}
                </th>
                <th style={{ textAlign: "left", fontWeight: "600", fontSize: "12px", color: "#666", paddingBottom: "8px" }}>
                  {t("mysql.tableManager.value")}
                </th>
              </tr>
            </thead>
            <tbody>
              {columns.map((column) => (
                <tr key={column.field} style={{ borderBottom: "1px solid #e8e8e8" }}>
                  <td style={{ padding: "8px 0", fontSize: "12px", color: "#333", width: "30%", paddingRight: "8px" }}>
                    <div style={{ fontWeight: "500" }}>{column.field}</div>
                    <div style={{ fontSize: "11px", color: "#999" }}>
                      {column.type}
                      {column.null === "YES" ? " (NULL)" : " (NOT NULL)"}
                    </div>
                  </td>
                  <td style={{ padding: "8px 0", fontSize: "12px" }}>
                    <input
                      type="text"
                      className="form-control"
                      value={formData[column.field] || ""}
                      onChange={(event) => onFieldChange(column.field, event.target.value)}
                      placeholder={column.default !== null && column.default !== undefined ? `${column.default}` : ""}
                      style={{ fontSize: "12px" }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="modal-card-footer" style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button className="btn btn-sm btn-ghost" onClick={onClose} type="button">
            {t("common.cancel")}
          </button>
          <button className="btn btn-sm btn-primary" onClick={onSave} type="button">
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
