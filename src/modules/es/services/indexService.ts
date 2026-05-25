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