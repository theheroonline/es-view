import type { EsConnection } from "../types";
import { esRequest } from "./client";

export interface CatIndexItem {
  index: string;
  health?: string;
  "docs.count"?: string;
}

export async function pingEsCluster(connection: EsConnection) {
  return esRequest(connection, "/_cluster/health");
}

export async function listEsIndices(connection: EsConnection): Promise<CatIndexItem[]> {
  return esRequest<CatIndexItem[]>(connection, "/_cat/indices?format=json");
}