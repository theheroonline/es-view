import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ColumnMeta, FilterCondition, FilterOperator } from "../types";

interface QueryGeneratorModalProps {
  isOpen: boolean;
  databases: string[];
  tablesByDb: Record<string, string[]>;
  columnMetaMap: Record<string, ColumnMeta[]>;
  selectedDatabase: string | undefined;
  onClose: () => void;
  onConfirm: (sql: string) => void;
  onConfirmAndExecute: (sql: string) => void;
}

function getDataTypeCategory(dataType: string): "text" | "number" | "date" | "boolean" | "other" {
  const typeStr = dataType.toLowerCase();

  if (typeStr.includes("char") || typeStr.includes("text") || typeStr.includes("json")) {
    return "text";
  }
  // Check for boolean types first (before int, since tinyint(1) contains "int")
  if (typeStr.startsWith("tinyint") || typeStr.includes("bool")) {
    return "boolean";
  }
  if (typeStr.includes("int") || typeStr.includes("float") || typeStr.includes("decimal") || typeStr.includes("double")) {
    return "number";
  }
  if (typeStr.includes("date") || typeStr.includes("time")) {
    return "date";
  }

  return "other";
}

function getOperatorsForType(category: "text" | "number" | "date" | "boolean" | "other"): FilterOperator[] {
  const baseOps: FilterOperator[] = ["IS NULL", "IS NOT NULL"];

  switch (category) {
    case "text":
      return ["=", "!=", "LIKE", "NOT LIKE", "IN", "BETWEEN", ...baseOps];
    case "number":
      return ["=", "!=", ">", "<", ">=", "<=", "IN", "BETWEEN", ...baseOps];
    case "date":
      return ["=", "!=", ">", "<", ">=", "<=", "BETWEEN", ...baseOps];
    case "boolean":
      return ["=", "!=", ...baseOps];
    default:
      return ["=", "!=", "BETWEEN", ...baseOps];
  }
}

function getInputType(category: "text" | "number" | "date" | "boolean" | "other", operator: FilterOperator): string {
  if (["IS NULL", "IS NOT NULL"].includes(operator)) {
    return "none";
  }
  if (operator === "BETWEEN") {
    return "between";
  }
  if (category === "number") return "number";
  if (category === "date") return "date";
  if (category === "boolean") return "select";
  return "text";
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

function generateSQL(table: string, conditions: FilterCondition[], operator: "AND" | "OR"): string {
  if (conditions.length === 0) {
    return `SELECT * FROM \`${table}\``;
  }

  const whereClause = conditions
    .map((c) => {
      if (["IS NULL", "IS NOT NULL"].includes(c.operator)) {
        return `\`${c.field}\` ${c.operator}`;
      }
      if (c.operator === "LIKE" || c.operator === "NOT LIKE") {
        const escapedValue = escapeSqlString(String(c.value));
        return `\`${c.field}\` ${c.operator} '%${escapedValue}%'`;
      }
      if (c.operator === "IN") {
        const values = String(c.value)
          .split(",")
          .map((v) => {
            const trimmed = v.trim();
            return isNaN(Number(trimmed)) ? `'${escapeSqlString(trimmed)}'` : trimmed;
          })
          .join(", ");
        return `\`${c.field}\` ${c.operator} (${values})`;
      }
      if (c.operator === "BETWEEN") {
        const parts = String(c.value).split(/\s+AND\s+/i);
        if (parts.length !== 2) {
          throw new Error(`BETWEEN operator requires two values separated by AND`);
        }
        const [val1, val2] = parts.map((v) => {
          const trimmed = v.trim();
          return isNaN(Number(trimmed)) ? `'${escapeSqlString(trimmed)}'` : trimmed;
        });
        return `\`${c.field}\` ${c.operator} ${val1} AND ${val2}`;
      }
      if (typeof c.value === "number") {
        return `\`${c.field}\` ${c.operator} ${c.value}`;
      }
      const escapedValue = escapeSqlString(String(c.value));
      return `\`${c.field}\` ${c.operator} '${escapedValue}'`;
    })
    .join(` ${operator} `);

  return `SELECT * FROM \`${table}\` WHERE ${whereClause}`;
}

export default function QueryGeneratorModal({
  isOpen,
  databases,
  tablesByDb,
  columnMetaMap,
  selectedDatabase,
  onClose,
  onConfirm,
  onConfirmAndExecute
}: QueryGeneratorModalProps) {
  const { t } = useTranslation();

  const [selectedTable, setSelectedTable] = useState("");
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [groupOperator, setGroupOperator] = useState<"AND" | "OR">("AND");

  // Reset state when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setSelectedTable("");
      setConditions([]);
      setGroupOperator("AND");
    }
  }, [isOpen]);

  const currentDatabase = selectedDatabase || (databases.length > 0 ? databases[0] : "");
  const tables = currentDatabase ? tablesByDb[currentDatabase] ?? [] : [];
  const tableKey = selectedTable && currentDatabase ? `${currentDatabase}::${selectedTable}` : selectedTable;
  const tableColumns = tableKey ? columnMetaMap[tableKey] ?? [] : [];

  const generatedSQL = useMemo(() => {
    if (!selectedTable || conditions.length === 0) return "";
    try {
      return generateSQL(selectedTable, conditions, groupOperator);
    } catch (err) {
      console.error("SQL generation error:", err);
      return "";
    }
  }, [selectedTable, conditions, groupOperator]);

  const isFormValid = selectedTable && conditions.length > 0 && conditions.every((c) => {
    // All conditions must have a field selected
    if (!c.field) return false;
    // If operator doesn't need a value, it's valid
    if (["IS NULL", "IS NOT NULL"].includes(c.operator)) return true;
    // For BETWEEN, need two non-empty values separated by AND
    if (c.operator === "BETWEEN") {
      const parts = String(c.value).split(/\s+AND\s+/i);
      return parts.length === 2 && parts[0].trim() !== "" && parts[1].trim() !== "";
    }
    // Otherwise, value must not be empty (but 0 and false are valid)
    return c.value !== "" && c.value !== null && c.value !== undefined;
  });

  const handleAddCondition = () => {
    const newCondition: FilterCondition = {
      id: `cond-${Date.now()}`,
      field: tableColumns[0]?.field || "",
      operator: "=",
      value: "",
      dataType: tableColumns[0]?.type
    };
    setConditions([...conditions, newCondition]);
  };

  const handleRemoveCondition = (id: string) => {
    setConditions(conditions.filter((c) => c.id !== id));
  };

  const handleConditionChange = (id: string, changes: Partial<FilterCondition>) => {
    setConditions(
      conditions.map((c) =>
        c.id === id
          ? {
              ...c,
              ...changes,
              dataType: changes.field
                ? tableColumns.find((col) => col.field === changes.field)?.type
                : c.dataType
            }
          : c
      )
    );
  };

  const handleConfirm = () => {
    if (!generatedSQL) return;
    onConfirm(generatedSQL);
  };

  const handleConfirmAndExecute = () => {
    if (!generatedSQL) return;
    onConfirmAndExecute(generatedSQL);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="card modal-card modal-card-lg" style={{ maxWidth: "600px" }}>
        <div className="card-header">
          <h3 className="card-title">{t("mysql.query.queryGenerator.title")}</h3>
        </div>

        <div className="modal-card-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Database and Table Selection */}
          <div style={{ display: "grid", gap: "8px" }}>
            <label style={{ fontSize: "13px", fontWeight: 500 }}>
              {t("mysql.query.queryGenerator.selectTable")}
            </label>
            <select
              className="form-control"
              value={selectedTable}
              onChange={(e) => {
                setSelectedTable(e.target.value);
                setConditions([]);
              }}
              disabled={tables.length === 0}
            >
              <option value="">{t("mysql.query.queryGenerator.selectTable")}</option>
              {tables.map((table) => (
                <option key={table} value={table}>
                  {table}
                </option>
              ))}
            </select>
          </div>

          {/* Conditions */}
          {selectedTable && (
            <div style={{ display: "grid", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label style={{ fontSize: "13px", fontWeight: 500 }}>
                  {t("mysql.query.queryGenerator.field")}
                </label>
                {conditions.length > 1 && (
                  <div style={{ display: "flex", gap: "4px" }}>
                    {(["AND", "OR"] as const).map((op) => (
                      <button
                        key={op}
                        className={`btn btn-sm ${groupOperator === op ? "btn-primary" : "btn-ghost"}`}
                        onClick={() => setGroupOperator(op)}
                        style={{ padding: "4px 8px", fontSize: "11px" }}
                      >
                        {op}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {conditions.map((condition) => {
                const columnMeta = tableColumns.find((c) => c.field === condition.field);
                const category = columnMeta ? getDataTypeCategory(columnMeta.type) : "text";
                const operators = getOperatorsForType(category);
                const inputType = getInputType(category, condition.operator as FilterOperator);

                return (
                  <div
                    key={condition.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr auto",
                      gap: "8px",
                      alignItems: "center",
                      padding: "12px",
                      background: "#f8fafc",
                      borderRadius: "6px"
                    }}
                  >
                    {/* Field */}
                    <select
                      className="form-control"
                      value={condition.field}
                      onChange={(e) => {
                        const newField = e.target.value;
                        const newMeta = tableColumns.find((c) => c.field === newField);
                        const newOperator = getOperatorsForType(getDataTypeCategory(newMeta?.type || ""))[0];
                        handleConditionChange(condition.id, {
                          field: newField,
                          operator: newOperator,
                          dataType: newMeta?.type
                        });
                      }}
                      style={{ fontSize: "12px" }}
                    >
                      <option value="">{t("mysql.query.queryGenerator.selectField")}</option>
                      {tableColumns.map((col) => (
                        <option key={col.field} value={col.field}>
                          {col.field} ({col.type})
                        </option>
                      ))}
                    </select>

                    {/* Operator */}
                    <select
                      className="form-control"
                      value={condition.operator}
                      onChange={(e) =>
                        handleConditionChange(condition.id, { operator: e.target.value as FilterOperator })
                      }
                      style={{ fontSize: "12px" }}
                    >
                      {operators.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>

                    {/* Value */}
                    {inputType === "none" ? (
                      <div />
                    ) : inputType === "select" ? (
                      <select
                        className="form-control"
                        value={String(condition.value)}
                        onChange={(e) => handleConditionChange(condition.id, { value: e.target.value })}
                        style={{ fontSize: "12px" }}
                      >
                        <option value="">-</option>
                        <option value="1">TRUE</option>
                        <option value="0">FALSE</option>
                      </select>
                    ) : inputType === "between" ? (
                      <div style={{ display: "flex", gap: "4px", alignItems: "center", gridColumn: "3" }}>
                        <input
                          type={category === "number" ? "number" : category === "date" ? "date" : "text"}
                          className="form-control"
                          value={String(condition.value).split(/\s+AND\s+/i)[0] || ""}
                          onChange={(e) => {
                            const parts = String(condition.value).split(/\s+AND\s+/i);
                            const newValue = `${e.target.value} AND ${parts[1] || ""}`;
                            handleConditionChange(condition.id, { value: newValue });
                          }}
                          placeholder={t("mysql.query.queryGenerator.enterValue")}
                          style={{ fontSize: "12px", flex: 1 }}
                        />
                        <span style={{ fontSize: "12px", color: "#6b7280", whiteSpace: "nowrap" }}>AND</span>
                        <input
                          type={category === "number" ? "number" : category === "date" ? "date" : "text"}
                          className="form-control"
                          value={String(condition.value).split(/\s+AND\s+/i)[1] || ""}
                          onChange={(e) => {
                            const parts = String(condition.value).split(/\s+AND\s+/i);
                            const newValue = `${parts[0] || ""} AND ${e.target.value}`;
                            handleConditionChange(condition.id, { value: newValue });
                          }}
                          placeholder={t("mysql.query.queryGenerator.enterValue")}
                          style={{ fontSize: "12px", flex: 1 }}
                        />
                      </div>
                    ) : (
                      <input
                        type={inputType}
                        className="form-control"
                        value={String(condition.value)}
                        onChange={(e) =>
                          handleConditionChange(condition.id, {
                            value: inputType === "number" ? parseFloat(e.target.value) || "" : e.target.value
                          })
                        }
                        placeholder={t("mysql.query.queryGenerator.enterValue")}
                        style={{ fontSize: "12px" }}
                      />
                    )}

                    {/* Remove Button */}
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => handleRemoveCondition(condition.id)}
                      style={{ padding: "4px 8px", color: "#dc2626" }}
                      title={t("mysql.query.queryGenerator.removeCondition")}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}

              <button
                className="btn btn-sm btn-ghost"
                onClick={handleAddCondition}
                disabled={tableColumns.length === 0}
                style={{ background: "transparent" }}
              >
                + {t("mysql.query.queryGenerator.addCondition")}
              </button>
            </div>
          )}

          {/* SQL Preview */}
          {generatedSQL && (
            <div style={{ display: "grid", gap: "8px" }}>
              <label style={{ fontSize: "13px", fontWeight: 500 }}>
                {t("mysql.query.queryGenerator.sqlPreview")}
              </label>
              <div
                style={{
                  padding: "12px",
                  background: "#f8fafc",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  overflow: "auto",
                  maxHeight: "120px",
                  color: "#1f2937"
                }}
              >
                {generatedSQL}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-card-footer" style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button className="btn btn-sm btn-ghost" onClick={onClose} style={{ background: "transparent" }}>
            {t("mysql.query.queryGenerator.cancel")}
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={handleConfirm}
            disabled={!isFormValid}
            style={{ background: "transparent" }}
          >
            {t("mysql.query.queryGenerator.confirm")}
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={handleConfirmAndExecute}
            disabled={!isFormValid}
          >
            {t("mysql.query.queryGenerator.confirmAndSearch")}
          </button>
        </div>
      </div>
    </div>
  );
}
