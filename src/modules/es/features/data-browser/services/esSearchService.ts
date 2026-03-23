import { loadEsIndexFields, searchEsDocuments } from "../../../services/searchService";
import type { EsConnection } from "../../../types";

export async function loadIndexFields(connection: EsConnection, index: string): Promise<string[]> {
  return loadEsIndexFields(connection, index);
}

export async function searchDocuments(connection: EsConnection, index: string, body: unknown) {
  return searchEsDocuments(connection, index, body);
}