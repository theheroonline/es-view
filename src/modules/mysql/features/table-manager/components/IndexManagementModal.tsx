import { useTranslation } from "react-i18next";
import type { ColumnMeta, IndexMeta } from "../../../types";

interface IndexFormData {
  name: string;
  columns: string[];
  unique: boolean;
  indexType: string;
}

interface IndexManagementModalProps {
  isOpen: boolean;
  mode: "view" | "create" | "edit";
  indexes: IndexMeta[];
  loading: boolean;
  error: string;
  formData: IndexFormData;
  tableColumns?: ColumnMeta[];
  onClose: () => void;
  onBackToView: () => void;
  onOpenCreate: () => void;
  onOpenEdit: (index: IndexMeta) => void;
  onDrop: (indexName: string) => void;
  onCreate: () => void;
  onUpdate: () => void;
  onNameChange: (name: string) => void;
  onToggleColumn: (column: string, checked: boolean) => void;
  onUniqueChange: (checked: boolean) => void;
  onIndexTypeChange: (indexType: string) => void;
}

export function IndexManagementModal({
  isOpen,
  mode,
  indexes,
  loading,
  error,
  formData,
  tableColumns,
  onClose,
  onBackToView,
  onOpenCreate,
  onOpenEdit,
  onDrop,
  onCreate,
  onUpdate,
  onNameChange,
  onToggleColumn,
  onUniqueChange,
  onIndexTypeChange,
}: IndexManagementModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="card modal-card modal-card-lg modal-card-scroll">
        <div className="card-header page-section-header">
          <h3 className="card-title">
            {mode === "view" ? t("mysql.tableManager.indexManagement") : mode === "create" ? t("mysql.tableManager.createNewIndex") : t("mysql.tableManager.editIndex")}
          </h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>{t("common.close")}</button>
        </div>

        <div className="modal-card-body modal-card-grid">
          {mode === "view" ? (
            <>
              <div className="flex-gap">
                <button
                  className="btn btn-sm btn-primary"
                  onClick={onOpenCreate}
                  disabled={!tableColumns || tableColumns.length === 0}
                >
                  + {t("mysql.tableManager.createIndex")}
                </button>
              </div>

              {error && <div className="text-danger">{error}</div>}

              {loading ? (
                <div className="muted">{t("common.loading")}</div>
              ) : indexes.filter((index) => !index.primary).length === 0 ? (
                <div className="muted">{t("common.noData")}</div>
              ) : (
                <div className="table-wrapper">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>{t("mysql.tableManager.indexName")}</th>
                        <th>{t("dataBrowser.field")}</th>
                        <th>{t("mysql.tableManager.indexType")}</th>
                        <th>{t("mysql.tableManager.uniqueIndex")}</th>
                        <th className="tm-table-head-actions">{t("dataBrowser.actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {indexes.filter((index) => !index.primary).map((index) => (
                        <tr key={index.name}>
                          <td><strong>{index.name}</strong></td>
                          <td>{index.columns.join(", ")}</td>
                          <td>{index.indexType}</td>
                          <td>{index.unique ? "✓" : "-"}</td>
                          <td className="tm-actions-cell">
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={() => onOpenEdit(index)}
                              disabled={loading}
                            >
                              {t("common.edit")}
                            </button>
                            <button
                              className="btn btn-sm btn-ghost text-danger"
                              onClick={() => onDrop(index.name)}
                              disabled={loading}
                            >
                              {t("common.delete")}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <label>{t("mysql.tableManager.indexName")} *</label>
                <input
                  className="form-control"
                  value={formData.name}
                  onChange={(event) => onNameChange(event.target.value)}
                  placeholder="e.g. idx_email"
                  disabled={mode === "edit"}
                />
              </div>

              <div>
                <label>{t("mysql.tableManager.selectColumns")} *</label>
                <div className="tm-index-columns">
                  {tableColumns?.map((column) => (
                    <label key={column.field} className="tm-checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.columns.includes(column.field)}
                        onChange={(event) => onToggleColumn(column.field, event.target.checked)}
                      />
                      <span>{column.field}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={formData.unique}
                    onChange={(event) => onUniqueChange(event.target.checked)}
                  />
                  {t("mysql.tableManager.uniqueIndex")}
                </label>
              </div>

              <div>
                <label>{t("mysql.tableManager.indexType")}</label>
                <select
                  className="form-control"
                  value={formData.indexType}
                  onChange={(event) => onIndexTypeChange(event.target.value)}
                >
                  <option value="BTREE">BTREE</option>
                  <option value="HASH">HASH</option>
                </select>
              </div>

              {error && <div className="text-danger">{error}</div>}
            </>
          )}
        </div>

        <div className="modal-card-footer">
          {mode === "create" ? (
            <>
              <button className="btn btn-sm btn-ghost" onClick={onBackToView}>
                {t("common.cancel")}
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={onCreate}
                disabled={loading || !formData.name || formData.columns.length === 0}
              >
                {loading ? t("common.loading") : t("mysql.tableManager.createIndex")}
              </button>
            </>
          ) : mode === "edit" ? (
            <>
              <button className="btn btn-sm btn-ghost" onClick={onBackToView}>
                {t("common.cancel")}
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={onUpdate}
                disabled={loading || !formData.name || formData.columns.length === 0}
              >
                {loading ? t("common.loading") : t("mysql.tableManager.updateIndex")}
              </button>
            </>
          ) : (
            <button className="btn btn-sm btn-ghost" onClick={onClose}>{t("common.close")}</button>
          )}
        </div>
      </div>
    </div>
  );
}
