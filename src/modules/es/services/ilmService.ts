import type { EsConnection } from "../types";
import { esRequest } from "./client";

export interface IlmPolicyListItem {
  name: string;
  phases: number;
}

export async function listEsIlmPolicies(connection: EsConnection): Promise<Record<string, any>> {
  return esRequest<Record<string, any>>(connection, "/_ilm/policy");
}

export async function createEsIlmPolicy(
  connection: EsConnection,
  name: string,
  body: unknown,
) {
  return esRequest<any>(connection, `/_ilm/policy/${encodeURIComponent(name)}`, { method: "PUT", body });
}

export async function deleteEsIlmPolicy(connection: EsConnection, name: string) {
  return esRequest<any>(connection, `/_ilm/policy/${encodeURIComponent(name)}`, { method: "DELETE" });
}

export async function getEsIlmExplain(connection: EsConnection, index = "*") {
  return esRequest<any>(connection, `/${encodeURIComponent(index)}/_ilm/explain`);
}

export async function moveIndexIlmPolicy(
  connection: EsConnection,
  index: string,
  policy: string,
) {
  return esRequest<any>(connection, `/${encodeURIComponent(index)}/_ilm/move`, {
    method: "POST",
    body: { policy },
  });
}

export async function removeIndexIlmPolicy(connection: EsConnection, index: string) {
  return esRequest<any>(connection, `/${encodeURIComponent(index)}/_ilm/remove`, { method: "POST" });
}
