import type { EsConnection } from "../types";
import { esRequestRaw } from "./client";

export async function executeEsRawRequest(
  connection: EsConnection,
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
) {
  return esRequestRaw(connection, path, options);
}