import type { EsConnection } from "../types";
import { esRequest } from "./client";

export async function deleteEsDocument(connection: EsConnection, index: string, id: string) {
  return esRequest<any>(connection, `/${index}/_doc/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function updateEsDocument(connection: EsConnection, index: string, id: string, doc: unknown) {
  return esRequest<any>(connection, `/${index}/_doc/${encodeURIComponent(id)}`, { method: "PUT", body: doc });
}

export async function refreshEsDocumentIndex(connection: EsConnection, index: string) {
  return esRequest<any>(connection, `/${index}/_refresh`, { method: "POST" });
}