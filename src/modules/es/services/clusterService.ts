import type { EsConnection } from "../types";
import { esRequest } from "./client";

export interface CatIndexItem {
  index: string;
  health?: string;
  "docs.count"?: string;
}

export interface EsVersionInfo {
  number: string;
  buildFlavor?: string;
  buildType?: string;
  buildHash?: string;
  luceneVersion?: string;
}

export async function listEsIndices(connection: EsConnection): Promise<CatIndexItem[]> {
  return esRequest<CatIndexItem[]>(connection, "/_cat/indices?format=json");
}

export async function pingEsCluster(connection: EsConnection, retries = 2) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await esRequest(connection, "/_cluster/health");
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

export async function detectEsVersion(connection: EsConnection): Promise<EsVersionInfo | null> {
  try {
    const data = await esRequest<{
      version: EsVersionInfo;
      cluster_name?: string;
      tagline?: string;
    }>(connection, "/");
    return data.version ?? null;
  } catch {
    return null;
  }
}
