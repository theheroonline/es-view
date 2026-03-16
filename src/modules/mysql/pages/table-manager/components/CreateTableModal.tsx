import { useTranslation } from "react-i18next";
import type { CreateTableModalState } from "../utils";
import { mysqlColumnTypeOptions } from "../utils";

interface CreateTableModalProps {
  isOpen: boolean;
  modalState: CreateTableModalState | null;
  editingRows: Array<{
    id: string;
    name: string;
    type: string;
    length: string;
    scale: string;
    nullable: boolean;
    defaultValue: string;
    isPrimary: boolean;
    autoIncrement: boolean;
    comment: string;
    timestampDefault?: "none" | "current_timestamp";
    timestampOnUpdate?: boolean;
    extraAttributes?: string;
  }>;
  selectedEditingRowId: string | null;
  isLoading: boolean;
  error: string;
  onTableNameChange: (name: string) => void;
  onEngineChange: (engine: string) => void;
  onCharsetChange: (charset: string) => void;
  onColumnNullableChange: (columnId: string, nullable: boolean) => void;
  onColumnPrimaryChange: (columnId: string, isPrimary: boolean) => void;
  onColumnAutoIncrementChange: (columnId: string, autoIncrement: boolean) => void;
  onDeleteColumn: (columnId: string) => void;
  onSelectEditingRow: (rowId: string) => void;
  onEditingRowNameChange: (rowId: string, name: string) => void;
  onEditingRowTypeChange: (rowId: string, type: string) => void;
  onEditingRowLengthChange: (rowId: string, length: string) => void;
  onEditingRowScaleChange: (rowId: string, scale: string) => void;
  onEditingRowNullableChange: (rowId: string, nullable: boolean) => void;
  onEditingRowPrimaryChange: (rowId: string, isPrimary: boolean) => void;
  onEditingRowAutoIncrementChange: (rowId: string, autoIncrement: boolean) => void;
  onEditingRowDefaultValueChange: (rowId: string, defaultValue: string) => void;
  onEditingRowCommentChange: (rowId: string, comment: string) => void;
  onEditingRowExtraAttributesChange: (rowId: string, extraAttributes: string) => void;
  onMoveEditingRowUp: (rowId: string) => void;
  onMoveEditingRowDown: (rowId: string) => void;
  onDeleteEditingRow: (rowId: string) => void;
  onClose: () => void;
  onSave: () => void;
  onAddColumn: () => void;
}

export function CreateTableModal({
  isOpen,
  modalState,
  editingRows,
  selectedEditingRowId,
  isLoading,
  error,
  onTableNameChange,
  onEngineChange,
  onCharsetChange,
  onColumnNullableChange,
  onColumnPrimaryChange,
  onColumnAutoIncrementChange,
  onDeleteColumn,
  onSelectEditingRow,
  onEditingRowNameChange,
  onEditingRowTypeChange,
  onEditingRowLengthChange,
  onEditingRowScaleChange,
  onEditingRowNullableChange,
  onEditingRowPrimaryChange,
  onEditingRowAutoIncrementChange,
  onEditingRowDefaultValueChange,
  onEditingRowCommentChange,
  onEditingRowExtraAttributesChange,
  onMoveEditingRowUp,
  onMoveEditingRowDown,
  onDeleteEditingRow,
  onClose,
  onSave,
  onAddColumn,
}: CreateTableModalProps) {
  const { t } = useTranslation();

  if (!isOpen || !modalState) return null;

  const selectedEditingRow = editingRows.find(r => r.id === selectedEditingRowId);

  return (
    <div className="modal-overlay" onClick={() => !isLoading && onClose()}>
      <div className="card modal-card modal-card-fullscreen" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="card-header page-section-header">
          <div>
            <h3 className="card-title">💾 {t("mysql.tableManager.createTableModal")}</h3>
            <p style={{ fontSize: "12px", color: "#666", margin: "4px 0 0 0" }}>
              {modalState.database}
            </p>
          </div>
          <button
            className="btn btn-sm btn-ghost"
            onClick={onClose}
            disabled={isLoading}
          >
            {t("common.close")}
          </button>
        </div>

        {/* Main content */}
        <div className="modal-card-body" style={{ display: "flex", flexDirection: "column", height: "calc(100% - 120px)" }}>
          {error && (
            <div className="text-danger modal-card-error">{error}</div>
          )}

          {/* Table Header with Basic Info */}
          <div className="mysql-create-table-header">
            <div className="mysql-create-table-basic-info">
              <div>
                <label>{t("mysql.tableManager.tableName")}</label>
                <input
                  className="form-control"
                  type="text"
                  value={modalState.tableName}
                  onChange={(e) => onTableNameChange(e.target.value)}
                  placeholder="my_table"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label>{t("mysql.tableManager.engine")}</label>
                <select
                  className="form-control"
                  value={modalState.engine}
                  onChange={(e) => onEngineChange(e.target.value)}
                  disabled={isLoading}
                >
                  <option value="InnoDB">InnoDB</option>
                  <option value="MyISAM">MyISAM</option>
                </select>
              </div>
              <div>
                <label>{t("mysql.tableManager.characterSet")}</label>
                <select
                  className="form-control"
                  value={modalState.charset}
                  onChange={(e) => onCharsetChange(e.target.value)}
                  disabled={isLoading}
                >
                  <option value="utf8mb4">utf8mb4</option>
                  <option value="utf8">utf8</option>
                  <option value="latin1">latin1</option>
                  <option value="ascii">ascii</option>
                </select>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="mysql-create-table-toolbar">
            <span style={{ color: "#666", fontSize: "13px", marginRight: "auto" }}>
              {modalState.columns.length} {modalState.columns.length === 1 ? "column" : "columns"}
            </span>
            <button
              className="btn btn-sm btn-primary"
              onClick={onAddColumn}
              disabled={isLoading}
            >
              ➕ {t("mysql.tableManager.addColumn")}
            </button>
          </div>

          {/* Columns table */}
          <div className="mysql-create-table-content" style={{ flex: 1, overflow: "auto" }}>
            <div className="table-wrapper">
              <table className="table mysql-create-table">
                <thead>
                  <tr>
                    <th style={{ width: "18%" }}>{t("mysql.tableManager.columnField")}</th>
                    <th style={{ width: "13%" }}>{t("mysql.tableManager.columnType")}</th>
                    <th style={{ width: "7%" }}>长度</th>
                    <th style={{ width: "7%" }}>小数点</th>
                    <th style={{ width: "7%" }}>{t("mysql.tableManager.columnNull")}</th>
                    <th style={{ width: "7%" }}>主键</th>
                    <th style={{ width: "7%" }}>{t("mysql.tableManager.autoIncrement")}</th>
                    <th style={{ width: "12%" }}>{t("mysql.tableManager.columnDefault")}</th>
                    <th style={{ width: "10%" }}>备注</th>
                    <th className="tm-table-head-actions" style={{ width: "7%" }}>{t("dataBrowser.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {modalState.columns.map((column) => (
                    <tr key={column.id} className={column.isPrimary ? "mysql-create-table-row-primary" : ""}>
                      <td className="mysql-create-table-field-name">{column.name || "(Untitled)"}</td>
                      <td>
                        <span className="pill">{column.type}</span>
                      </td>
                      <td style={{ textAlign: "center", fontSize: "13px" }}>
                        {column.length ? <span>{column.length}</span> : <span style={{ color: "#999" }}>-</span>}
                      </td>
                      <td style={{ textAlign: "center", fontSize: "13px" }}>
                        {column.scale ? <span>{column.scale}</span> : <span style={{ color: "#999" }}>-</span>}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={column.nullable}
                          onChange={(e) => onColumnNullableChange(column.id, e.target.checked)}
                          disabled={isLoading}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={column.isPrimary}
                          onChange={(e) => onColumnPrimaryChange(column.id, e.target.checked)}
                          disabled={isLoading}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={column.autoIncrement}
                          onChange={(e) => onColumnAutoIncrementChange(column.id, e.target.checked)}
                          disabled={isLoading}
                        />
                      </td>
                      <td style={{ color: "#999", fontSize: "12px" }}>
                        {column.defaultValue || "NULL"}
                      </td>
                      <td style={{ color: "#999", fontSize: "12px" }}>
                        -
                      </td>
                      <td className="tm-actions-cell">
                        <button
                          className="btn btn-sm btn-ghost text-danger"
                          onClick={() => onDeleteColumn(column.id)}
                          disabled={isLoading}
                          title={t("common.delete")}
                        >
                          -
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Editing rows */}
                  {editingRows.map((row) => (
                    <tr
                      key={row.id}
                      className="mysql-create-table-new-row"
                      onClick={() => onSelectEditingRow(row.id)}
                    >
                      <td>
                        <input
                          className="form-control"
                          type="text"
                          value={row.name}
                          onChange={(e) => onEditingRowNameChange(row.id, e.target.value)}
                          placeholder={t("mysql.tableManager.columnName")}
                          disabled={isLoading}
                        />
                      </td>
                      <td>
                        <select
                          className="form-control"
                          value={row.type}
                          onChange={(e) => onEditingRowTypeChange(row.id, e.target.value)}
                          disabled={isLoading}
                        >
                          {mysqlColumnTypeOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {mysqlColumnTypeOptions.find(opt => opt.value === row.type)?.lengthMode !== "none" && (
                          <input
                            className="form-control"
                            type="text"
                            value={row.length}
                            onChange={(e) => onEditingRowLengthChange(row.id, e.target.value)}
                            placeholder="-"
                            disabled={isLoading}
                            style={{ fontSize: "12px" }}
                          />
                        )}
                      </td>
                      <td>
                        {mysqlColumnTypeOptions.find(opt => opt.value === row.type)?.lengthMode === "pair" && (
                          <input
                            className="form-control"
                            type="text"
                            value={row.scale}
                            onChange={(e) => onEditingRowScaleChange(row.id, e.target.value)}
                            placeholder="-"
                            disabled={isLoading}
                            style={{ fontSize: "12px" }}
                          />
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={row.nullable}
                          onChange={(e) => onEditingRowNullableChange(row.id, e.target.checked)}
                          disabled={isLoading}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={row.isPrimary}
                          onChange={(e) => onEditingRowPrimaryChange(row.id, e.target.checked)}
                          disabled={isLoading}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={row.autoIncrement}
                          onChange={(e) => onEditingRowAutoIncrementChange(row.id, e.target.checked)}
                          disabled={isLoading}
                        />
                      </td>
                      <td>
                        <input
                          className="form-control"
                          type="text"
                          value={row.defaultValue}
                          onChange={(e) => onEditingRowDefaultValueChange(row.id, e.target.value)}
                          placeholder="NULL"
                          disabled={isLoading}
                          style={{ fontSize: "12px" }}
                        />
                      </td>
                      <td>
                        <input
                          className="form-control"
                          type="text"
                          value={row.comment}
                          onChange={(e) => onEditingRowCommentChange(row.id, e.target.value)}
                          placeholder="-"
                          disabled={isLoading}
                          style={{ fontSize: "12px" }}
                        />
                      </td>
                      <td className="tm-actions-cell">
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveEditingRowUp(row.id);
                          }}
                          disabled={isLoading || editingRows.findIndex(r => r.id === row.id) === 0}
                          title="上移"
                        >
                          ↑
                        </button>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveEditingRowDown(row.id);
                          }}
                          disabled={isLoading || editingRows.findIndex(r => r.id === row.id) === editingRows.length - 1}
                          title="下移"
                        >
                          ↓
                        </button>
                        <button
                          className="btn btn-sm btn-ghost text-danger"
                          onClick={() => onDeleteEditingRow(row.id)}
                          disabled={isLoading}
                          title="删除"
                        >
                          -
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-card-footer" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {/* Extra attributes input on the left */}
          {selectedEditingRow && (
            <div style={{ flex: 1, display: "flex", gap: "8px", alignItems: "center" }}>
              <label style={{ fontSize: "12px", color: "#666", whiteSpace: "nowrap" }}>额外属性:</label>
              <input
                className="form-control"
                type="text"
                value={selectedEditingRow.extraAttributes || ""}
                onChange={(e) => onEditingRowExtraAttributesChange(selectedEditingRowId!, e.target.value)}
                placeholder="e.g., DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
                disabled={isLoading}
                style={{ fontSize: "12px", flex: 1 }}
              />
            </div>
          )}

          {/* Buttons on the right */}
          <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
            <button
              className="btn btn-sm btn-ghost"
              onClick={onClose}
              disabled={isLoading}
            >
              {t("common.cancel")}
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={onSave}
              disabled={isLoading || !modalState.tableName.trim() || (modalState.columns.length === 0 && editingRows.filter(r => r.name.trim()).length === 0)}
            >
              {isLoading ? t("common.loading") : "💾 " + t("common.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
