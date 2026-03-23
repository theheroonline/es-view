import {
    deleteEsDocument as deleteEsDocumentRecord,
    refreshEsDocumentIndex as refreshEsDocumentIndexRecord,
    updateEsDocument as updateEsDocumentRecord,
} from "../../../services/documentService";
import type { EsConnection } from "../../../types";

export async function deleteEsDocument(connection: EsConnection, index: string, id: string) {
  return deleteEsDocumentRecord(connection, index, id);
}

export async function updateEsDocument(connection: EsConnection, index: string, id: string, doc: unknown) {
  return updateEsDocumentRecord(connection, index, id, doc);
}

export async function refreshEsDocumentIndex(connection: EsConnection, index: string) {
  return refreshEsDocumentIndexRecord(connection, index);
}