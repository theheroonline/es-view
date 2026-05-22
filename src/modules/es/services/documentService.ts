import type { EsConnection } from "../types";
import { esRequest, esRequestRaw } from "./client";
import { buildDocUrl } from "./versionCompat";

export async function deleteEsDocument(
  connection: EsConnection,
  index: string,
  id: string,
) {
  const path = buildDocUrl(index, encodeURIComponent(id), connection.esVersion);
  return esRequest<any>(connection, path, { method: "DELETE" });
}

export async function updateEsDocument(
  connection: EsConnection,
  index: string,
  id: string,
  doc: unknown,
) {
  const path = buildDocUrl(index, encodeURIComponent(id), connection.esVersion);
  return esRequest<any>(connection, path, { method: "PUT", body: doc });
}

export async function createEsDocument(
  connection: EsConnection,
  index: string,
  doc: unknown,
  id?: string,
) {
  const path = id
    ? buildDocUrl(index, encodeURIComponent(id), connection.esVersion)
    : buildDocUrl(index, undefined, connection.esVersion);
  return esRequest<any>(connection, path, { method: id ? "PUT" : "POST", body: doc });
}

export async function bulkEsDocuments(
  connection: EsConnection,
  index: string,
  ndjsonBody: string,
) {
  const path = `/${index}/_bulk`;
  const raw = await esRequestRaw(connection, path, {
    method: "POST",
    body: ndjsonBody,
  });

  if (!raw.ok) {
    throw new Error(raw.body || `Bulk request failed: ${raw.status}`);
  }

  return JSON.parse(raw.body) as {
    errors: boolean;
    items: Array<Record<string, { status: number; error?: unknown }>>;
  };
}

export async function refreshEsDocumentIndex(connection: EsConnection, index: string) {
  return esRequest<any>(connection, `/${index}/_refresh`, { method: "POST" });
}