/**
 * Column type parsing and building utilities
 */

import { getColumnTypeOption, mysqlColumnTypeOptions } from "./constants";
import type { ColumnEditForm } from "./typeHelpers";

export { mysqlColumnTypeOptions, getColumnTypeOption };

/**
 * Parse MySQL column type string into component parts
 * Example: "VARCHAR(255) UNSIGNED" → { typeName: "varchar", length: "255", unsigned: true, ... }
 * Example: "DECIMAL(10,2)" → { typeName: "decimal", length: "10", scale: "2", ... }
 * Falls back to "custom" type for unrecognized types
 */
export const parseColumnType = (
  type: string
): Pick<ColumnEditForm, "typeName" | "length" | "scale" | "unsigned" | "customType"> => {
  const normalized = type.trim().toLowerCase();
  const match = normalized.match(/^([a-z]+)(?:\(([^)]*)\))?(?:\s+(unsigned))?$/i);

  if (!match) {
    return {
      typeName: "custom",
      length: "",
      scale: "",
      unsigned: false,
      customType: type
    };
  }

  const [, baseTypeRaw, paramsRaw = "", unsignedRaw] = match;
  const baseType = baseTypeRaw.toLowerCase();

  if (!getColumnTypeOption(baseType)) {
    return {
      typeName: "custom",
      length: "",
      scale: "",
      unsigned: false,
      customType: type
    };
  }

  const [length = "", scale = ""] = paramsRaw.split(",").map((item) => item.trim());

  return {
    typeName: baseType,
    length,
    scale,
    unsigned: Boolean(unsignedRaw),
    customType: ""
  };
};

/**
 * Build MySQL column type string from form components
 * Example: { typeName: "varchar", length: "255" } → "VARCHAR(255)"
 * Example: { typeName: "decimal", length: "10", scale: "2", unsigned: true } → "DECIMAL(10,2) UNSIGNED"
 */
export const buildColumnType = (form: ColumnEditForm): string => {
  if (form.typeName === "custom") {
    return form.customType.trim();
  }

  const option = getColumnTypeOption(form.typeName);
  if (!option) return "";

  const length = form.length.trim();
  const scale = form.scale.trim();
  let type = form.typeName;

  if (option.lengthMode === "single" && length) {
    type += `(${length})`;
  }

  if (option.lengthMode === "pair") {
    if (length && scale) {
      type += `(${length},${scale})`;
    } else if (length) {
      type += `(${length})`;
    }
  }

  if (option.supportsUnsigned && form.unsigned) {
    type += " UNSIGNED";
  }

  return type;
};
