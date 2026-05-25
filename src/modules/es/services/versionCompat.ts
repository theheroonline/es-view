/**
 * Elasticsearch version compatibility utilities.
 * Handles URL building and mapping parsing differences between ES 6.x, 7.x, and 8.x.
 */

export function parseMajorVersion(version?: string): number | null {
  if (!version) return null;
  const match = version.match(/^(\d+)\./);
  return match ? parseInt(match[1], 10) : null;
}

export function isEsV6(version?: string): boolean {
  return parseMajorVersion(version) === 6;
}

export function isEsV7(version?: string): boolean {
  return parseMajorVersion(version) === 7;
}

export function isEsV8OrLater(version?: string): boolean {
  const major = parseMajorVersion(version);
  return major !== null && major >= 8;
}

export function supportsIlm(version?: string): boolean {
  // ILM introduced in ES 6.6, but we only support 7+
  return !isEsV6(version);
}

export function supportsComposableTemplates(version?: string): boolean {
  // Composable templates introduced in ES 7.8
  if (isEsV6(version)) return false;
  if (isEsV7(version)) {
    // 7.8+ has composable templates
    if (!version) return true;
    return version >= "7.8.0";
  }
  return true;
}

/**
 * Build document API URL with version-aware path structure.
 * V6: /{index}/{type}/_doc or /{index}/{type}/{id}
 * V7+/V8+: /{index}/_doc or /{index}/_doc/{id}
 *
 * @param index - Index name
 * @param id - Optional document ID
 * @param version - ES version string
 * @param type - Optional type for V6 (defaults to "_doc")
 */
export function buildDocUrl(
  index: string,
  id?: string,
  version?: string,
  type?: string,
): string {
  if (isEsV6(version)) {
    const docType = type || "_doc";
    return id ? `/${index}/${docType}/${id}` : `/${index}/${docType}/_doc`;
  }
  // V7+
  return id ? `/${index}/_doc/${id}` : `/${index}/_doc`;
}

/**
 * Build search URL with version-aware path structure.
 * V6: /{index}/{type}/_search
 * V7+/V8+: /{index}/_search
 */
export function buildSearchUrl(index: string, version?: string, type?: string): string {
  if (isEsV6(version) && type) {
    return `/${index}/${type}/_search`;
  }
  return `/${index}/_search`;
}

/**
 * Parse mapping properties from ES mapping response, handling V6 type nesting.
 * V6: mappings.{typeName}.properties
 * V7/V8: mappings.properties or mappings._doc.properties
 *
 * Returns a flat map of field path -> field definition.
 */
export function parseMappingProperties(
  mapping: unknown,
  _indexName: string,
  version?: string,
): Record<string, { type?: string }> {
  if (!mapping || typeof mapping !== "object") return {};

  const mappings = (mapping as Record<string, unknown>)[_indexName] ?? mapping;
  if (!mappings || typeof mappings !== "object") return {};

  const propertiesContainer = (mappings as Record<string, unknown>).mappings;
  if (!propertiesContainer || typeof propertiesContainer !== "object") return {};

  if (isEsV6(version)) {
    // V6: mappings.{type}.properties — pick first type key
    const typeKeys = Object.keys(propertiesContainer as object);
    if (typeKeys.length === 0) return {};
    const firstType = (propertiesContainer as Record<string, unknown>)[typeKeys[0]];
    if (firstType && typeof firstType === "object" && "properties" in firstType) {
      return extractFieldPaths(
        (firstType as Record<string, unknown>).properties as Record<string, unknown>,
        "",
      );
    }
    return {};
  }

  // V7/V8: mappings.properties (flat) or mappings._doc.properties
  const directProps = (propertiesContainer as Record<string, unknown>).properties;
  if (directProps && typeof directProps === "object") {
    return extractFieldPaths(directProps as Record<string, unknown>, "");
  }

  // Fallback: check for _doc type
  const docType = (propertiesContainer as Record<string, unknown>)._doc;
  if (docType && typeof docType === "object" && "properties" in docType) {
    return extractFieldPaths(
      (docType as Record<string, unknown>).properties as Record<string, unknown>,
      "",
    );
  }

  return {};
}

/**
 * Recursively extract field paths from mapping properties.
 * Handles nested objects (dot-notation paths) and array types.
 */
function extractFieldPaths(
  properties: Record<string, unknown>,
  prefix: string,
): Record<string, { type?: string }> {
  const result: Record<string, { type?: string }> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (!value || typeof value !== "object") continue;

    const fieldDef = value as Record<string, unknown>;
    const fullPath = prefix ? `${prefix}.${key}` : key;
    const fieldType = fieldDef.type as string | undefined;

    result[fullPath] = { type: fieldType };

    // Recurse into nested objects
    if (fieldType === "object" && "properties" in fieldDef) {
      const nestedProps = fieldDef.properties as Record<string, unknown>;
      Object.assign(result, extractFieldPaths(nestedProps, fullPath));
    }

    // Handle flattened/nested keyword fields
    if (fieldType === "nested" && "properties" in fieldDef) {
      const nestedProps = fieldDef.properties as Record<string, unknown>;
      Object.assign(result, extractFieldPaths(nestedProps, fullPath));
    }
  }

  return result;
}
