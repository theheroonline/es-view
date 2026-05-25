import { useTranslation } from "react-i18next";
import {
    getColumnTypeOption,
    mysqlColumnTypeOptions,
    type ColumnEditForm,
    type ColumnEditMode,
} from "../utils";

interface ColumnEditModalProps {
  isOpen: boolean;
  mode: ColumnEditMode;
  originalField: string;
  form: ColumnEditForm;
  loading: boolean;
  error: string;
  onClose: () => void;
  onSave: () => void;
  onFormChange: (updater: (previous: ColumnEditForm) => ColumnEditForm) => void;
}

export function ColumnEditModal({
  isOpen,
  mode,
  originalField,
  form,
  loading,
  error,
  onClose,
  onSave,
  onFormChange,
}: ColumnEditModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="card modal-card modal-card-lg modal-card-scroll">
        <div className="card-header page-section-header">
          <h3 className="card-title">
            {mode === "add" ? t("mysql.tableManager.addColumn") : t("mysql.tableManager.editStructure")}
          </h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>{t("common.close")}</button>
        </div>
        <div className="modal-card-body modal-card-grid-2">
          <div>
            <label>{t("mysql.tableManager.columnName")}</label>
            <input
              className="form-control"
              value={form.field}
              disabled={mode === "edit" && Boolean(originalField)}
              onChange={(event) => onFormChange((previous) => ({ ...previous, field: event.target.value }))}
            />
          </div>
          <div>
            <label>{t("mysql.tableManager.columnType")}</label>
            <div className="tm-compact-grid">
              <select
                className="form-control"
                value={form.typeName}
                onChange={(event) => {
                  const nextTypeName = event.target.value;
                  const option = getColumnTypeOption(nextTypeName);
                  onFormChange((previous) => ({
                    ...previous,
                    typeName: nextTypeName,
                    length: option?.lengthMode === "none" ? "" : previous.length,
                    scale: option?.lengthMode === "pair" ? previous.scale : "",
                    unsigned: option?.supportsUnsigned ? previous.unsigned : false,
                    customType: nextTypeName === "custom" ? previous.customType : ""
                  }));
                }}
              >
                {mysqlColumnTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {form.typeName === "custom" ? (
                <input
                  className="form-control"
                  value={form.customType}
                  onChange={(event) => onFormChange((previous) => ({ ...previous, customType: event.target.value }))}
                  placeholder="varchar(255) / enum('a','b')"
                />
              ) : (
                <div className="tm-compact-grid-2">
                  <input
                    className="form-control"
                    value={form.length}
                    disabled={getColumnTypeOption(form.typeName)?.lengthMode === "none"}
                    onChange={(event) => onFormChange((previous) => ({ ...previous, length: event.target.value.replace(/[^0-9]/g, "") }))}
                    placeholder={t("mysql.tableManager.typeLength")}
                  />
                  <input
                    className="form-control"
                    value={form.scale}
                    disabled={getColumnTypeOption(form.typeName)?.lengthMode !== "pair"}
                    onChange={(event) => onFormChange((previous) => ({ ...previous, scale: event.target.value.replace(/[^0-9]/g, "") }))}
                    placeholder={t("mysql.tableManager.typeScale")}
                  />
                </div>
              )}
            </div>
          </div>
          <div>
            <label>{t("mysql.tableManager.defaultValue")}</label>
            <input
              className="form-control"
              value={form.defaultValue}
              onChange={(event) => onFormChange((previous) => ({ ...previous, defaultValue: event.target.value }))}
              placeholder="NULL / CURRENT_TIMESTAMP / text"
            />
          </div>
          <div>
            <label>{t("mysql.tableManager.extra")}</label>
            <input
              className="form-control"
              value={form.extra}
              onChange={(event) => onFormChange((previous) => ({ ...previous, extra: event.target.value }))}
              placeholder="AUTO_INCREMENT"
            />
          </div>
          <div className="tm-inline-checkbox">
            <input
              id="column-nullable"
              type="checkbox"
              checked={form.nullable}
              onChange={(event) => onFormChange((previous) => ({ ...previous, nullable: event.target.checked }))}
            />
            <label htmlFor="column-nullable">{t("mysql.tableManager.nullable")}</label>
          </div>
          <div className="tm-inline-checkbox">
            <input
              id="column-unsigned"
              type="checkbox"
              checked={form.unsigned}
              disabled={!getColumnTypeOption(form.typeName)?.supportsUnsigned || form.typeName === "custom"}
              onChange={(event) => onFormChange((previous) => ({ ...previous, unsigned: event.target.checked }))}
            />
            <label htmlFor="column-unsigned">{t("mysql.tableManager.unsigned")}</label>
          </div>
          <div className="tm-inline-checkbox">
            <input
              id="column-auto-increment"
              type="checkbox"
              checked={form.autoIncrement}
              onChange={(event) => onFormChange((previous) => ({ ...previous, autoIncrement: event.target.checked }))}
            />
            <label htmlFor="column-auto-increment">{t("mysql.tableManager.autoIncrement")}</label>
          </div>
        </div>
        {error && <div className="text-danger modal-card-error">{error}</div>}
        <div className="modal-card-footer">
          <button className="btn btn-sm btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn btn-sm btn-primary" onClick={onSave} disabled={loading}>
            {loading ? t("common.loading") : t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
