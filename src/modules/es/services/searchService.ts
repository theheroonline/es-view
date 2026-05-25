import type { EsConnection } from "../types";
import { esRequest } from "./client";

function extractFieldsFromMapping(mapping: any, indexName: string): string[] {
  const fields: string[] = [];
  const properties = mapping?.[indexName]?.mappings?.properties;
  if (!properties) return fields;

  function traverse(props: any, prefix = "") {
    for (const key in props) {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      fields.push(fullPath);
      if (props[key].properties) {
        traverse(props[key].properties, fullPath);
      }
    }
  }

  traverse(properties);
  return fields;
}

export async function loadEsIndexFields(connection: EsConnection, index: string): Promise<string[]> {
  const mapping = await esRequest<any>(connection, `/${index}/_mapping`);
  return extractFieldsFromMapping(mapping, index);
}

export async function searchEsDocuments(connection: EsConnection, index: string, body: unknown) {
  return esRequest<any>(connection, `/${index}/_search`, { method: "POST", body });
}