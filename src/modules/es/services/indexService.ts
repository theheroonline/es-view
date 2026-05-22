import type { EsConnection } from "../types";
import { esRequest } from "./client";

export async function createEsIndex(connection: EsConnection, index: string, body: unknown) {
  return esRequest<any>(connection, `/${index}`, { method: "PUT", body });
}

export async function deleteEsIndex(connection: EsConnection, index: string) {
  return esRequest<any>(connection, `/${index}`, { method: "DELETE" });
}

export async function getEsIndexInfo(connection: EsConnection, index: string) {
  return esRequest<any>(connection, `/${index}`);
}

export async function refreshEsIndex(connection: EsConnection, index: string) {
  return esRequest<any>(connection, `/${index}/_refresh`, { method: "POST" });
}

// -- Index Enhancement APIs --

export async function getEsIndexSettings(connection: EsConnection, index: string) {
  return esRequest<any>(connection, `/${index}/_settings`);
}

export async function getEsIndexMapping(connection: EsConnection, index: string) {
  return esRequest<any>(connection, `/${index}/_mapping`);
}

export async function getEsIndexStats(connection: EsConnection, index: string) {
  return esRequest<any>(connection, `/${index}/_stats`);
}

export async function addEsIndexAlias(connection: EsConnection, index: string, alias: string) {
  return esRequest<any>(connection, `/${index}/_alias/${encodeURIComponent(alias)}`, { method: "PUT" });
}

export async function removeEsIndexAlias(connection: EsConnection, index: string, alias: string) {
  return esRequest<any>(connection, `/${index}/_alias/${encodeURIComponent(alias)}`, { method: "DELETE" });
}

export async function listEsIndexAliases(connection: EsConnection) {
  return esRequest<Array<{ index: string; alias: string }>>(connection, "/_cat/aliases?format=json");
}

export async function openEsIndex(connection: EsConnection, index: string) {
  return esRequest<any>(connection, `/${index}/_open`, { method: "POST" });
}

export async function closeEsIndex(connection: EsConnection, index: string) {
  return esRequest<any>(connection, `/${index}/_close`, { method: "POST" });
}

export async function reindexEsIndices(connection: EsConnection, source: string, dest: string, waitForCompletion = true) {
  const params = waitForCompletion ? "" : "?wait_for_completion=false";
  return esRequest<any>(connection, `/_reindex${params}`, {
    method: "POST",
    body: { source: { index: source }, dest: { index: dest } },
  });
}