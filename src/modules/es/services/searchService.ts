import type { EsConnection } from "../types";
import { esRequest } from "./client";
import { parseMappingProperties } from "./versionCompat";

export async function loadEsIndexFields(connection: EsConnection, index: string): Promise<string[]> {
  const mapping = await esRequest<any>(connection, `/${index}/_mapping`);
  const fieldsMap = parseMappingProperties(mapping, index, connection.esVersion);
  return Object.keys(fieldsMap);
}

export async function searchEsDocuments(connection: EsConnection, index: string, body: unknown) {
  return esRequest<any>(connection, `/${index}/_search`, { method: "POST", body });
}