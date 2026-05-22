import type { EsConnection } from "../types";
import { esRequest } from "./client";

export interface TemplateListItem {
  name: string;
  type: "legacy" | "composable";
}

export async function listEsTemplates(connection: EsConnection): Promise<TemplateListItem[]> {
  const items: TemplateListItem[] = [];

  // Legacy templates
  try {
    const data = await esRequest<Record<string, unknown>>(connection, "/_template");
    for (const name of Object.keys(data || {})) {
      items.push({ name, type: "legacy" });
    }
  } catch {
    // Ignore if endpoint not available
  }

  // Composable templates (ES 7.8+)
  try {
    const data = await esRequest<{ index_templates: Array<{ name: string }> }>(connection, "/_index_template");
    for (const tpl of data?.index_templates || []) {
      items.push({ name: tpl.name, type: "composable" });
    }
  } catch {
    // Ignore if endpoint not available
  }

  return items;
}

export async function getEsTemplate(connection: EsConnection, name: string, type: "legacy" | "composable") {
  const path = type === "composable"
    ? `/_index_template/${encodeURIComponent(name)}`
    : `/_template/${encodeURIComponent(name)}`;
  return esRequest<any>(connection, path);
}

export async function createEsTemplate(
  connection: EsConnection,
  name: string,
  type: "legacy" | "composable",
  body: unknown,
) {
  const path = type === "composable"
    ? `/_index_template/${encodeURIComponent(name)}`
    : `/_template/${encodeURIComponent(name)}`;
  return esRequest<any>(connection, path, { method: "PUT", body });
}

export async function deleteEsTemplate(
  connection: EsConnection,
  name: string,
  type: "legacy" | "composable",
) {
  const path = type === "composable"
    ? `/_index_template/${encodeURIComponent(name)}`
    : `/_template/${encodeURIComponent(name)}`;
  return esRequest<any>(connection, path, { method: "DELETE" });
}
