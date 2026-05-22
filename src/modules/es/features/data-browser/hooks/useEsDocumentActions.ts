import { Modal } from "antd";
import type { TFunction } from "i18next";
import { logError } from "../../../../../lib/errorLog";
import { createEsDocument, deleteEsDocument, refreshEsDocumentIndex, updateEsDocument } from "../services/esDocumentService";

interface SearchRow {
  _id: string;
  _index: string;
  _source?: Record<string, unknown>;
}

interface UseEsDocumentActionsParams {
  activeConnection: any;
  editJson: string;
  editingDoc: SearchRow | null;
  execute: () => Promise<void>;
  executeQuery: () => Promise<any>;
  selectedIndex?: string;
  selectedRows: SearchRow[];
  setDeleteConfirmDialog: (value: { docIndex: string; docId: string } | null) => void;
  setEditJson: (value: string) => void;
  setEditingDoc: (value: SearchRow | null) => void;
  setError: (value: string) => void;
  setLoading: (value: boolean) => void;
  setResult: (value: any) => void;
  setSelectedDocs: (value: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setShowEditModal: (value: boolean) => void;
  // Create document state
  createDocId: string;
  createDocJson: string;
  setShowCreateModal: (value: boolean) => void;
  setCreateDocId: (value: string) => void;
  setCreateDocJson: (value: string) => void;
  t: TFunction;
}

export function useEsDocumentActions({
  activeConnection,
  editJson,
  editingDoc,
  execute,
  executeQuery,
  selectedIndex,
  selectedRows,
  setDeleteConfirmDialog,
  setEditJson,
  setEditingDoc,
  setError,
  setLoading,
  setResult,
  setSelectedDocs,
  setShowEditModal,
  createDocId,
  createDocJson,
  setShowCreateModal,
  setCreateDocId,
  setCreateDocJson,
  t,
}: UseEsDocumentActionsParams) {
  const requestDeleteDoc = (docIndex: string, docId: string) => {
    setDeleteConfirmDialog({ docIndex, docId });
  };

  const openEdit = (row: SearchRow) => {
    setEditingDoc(row);
    setEditJson(JSON.stringify(row._source, null, 2));
    setShowEditModal(true);
  };

  const confirmDeleteDoc = async (docIndex: string, docId: string) => {
    if (!activeConnection) return;
    try {
      setLoading(true);
      setError("");
      await deleteEsDocument(activeConnection, docIndex, docId);
      await refreshEsDocumentIndex(activeConnection, docIndex);
      setSelectedDocs((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
      const response = await executeQuery();
      setResult(response);
    } catch (error) {
      logError(error, {
        source: "esDataBrowser.deleteDocument",
        message: `Failed to delete Elasticsearch document ${docId}`,
      });
      setError(t("dataBrowser.deleteFailed") + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
      setDeleteConfirmDialog(null);
    }
  };

  const submitEdit = async () => {
    if (!activeConnection || !editingDoc) return;
    try {
      setLoading(true);
      setError("");
      const body = JSON.parse(editJson);
      await updateEsDocument(activeConnection, editingDoc._index, editingDoc._id, body);
      await refreshEsDocumentIndex(activeConnection, editingDoc._index);
      setShowEditModal(false);
      setEditingDoc(null);
      const response = await executeQuery();
      setResult(response);
    } catch (error) {
      logError(error, {
        source: "esDataBrowser.updateDocument",
        message: `Failed to update Elasticsearch document ${editingDoc?._id ?? "unknown"}`,
      });
      setError(t("dataBrowser.updateFailed") + (error instanceof Error ? error.message : t("dataBrowser.checkJsonFormat")));
    } finally {
      setLoading(false);
    }
  };

  const openCreateDoc = () => {
    setCreateDocId("");
    setCreateDocJson("{}");
    setShowCreateModal(true);
  };

  const submitCreateDoc = async () => {
    if (!activeConnection || !selectedIndex) return;
    try {
      setLoading(true);
      setError("");
      const body = JSON.parse(createDocJson);
      await createEsDocument(activeConnection, selectedIndex, body, createDocId || undefined);
      await refreshEsDocumentIndex(activeConnection, selectedIndex);
      setShowCreateModal(false);
      setCreateDocId("");
      setCreateDocJson("");
      const response = await executeQuery();
      setResult(response);
    } catch (error) {
      logError(error, {
        source: "esDataBrowser.createDocument",
        message: "Failed to create Elasticsearch document",
      });
      setError(t("dataBrowser.createFailed") + (error instanceof Error ? error.message : t("dataBrowser.checkJsonFormat")));
    } finally {
      setLoading(false);
    }
  };

  const deleteSelectedDocs = async () => {
    if (selectedRows.length === 0 || !activeConnection) return;

    const confirmed = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: t("common.confirm"),
        content: t("dataBrowser.deleteMultiple", { count: selectedRows.length }),
        okType: "danger",
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
    if (!confirmed) return;

    try {
      setLoading(true);
      const results = await Promise.allSettled(
        selectedRows.map((row) => deleteEsDocument(activeConnection, row._index, row._id))
      );
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0 && failures.length === results.length) {
        throw new Error(t("dataBrowser.deleteFailed") + " All deletions failed.");
      }
      if (selectedIndex) {
        await refreshEsDocumentIndex(activeConnection, selectedIndex);
      }
      setSelectedDocs(new Set());
      await execute();
    } catch (error) {
      logError(error, {
        source: "esDataBrowser.deleteSelected",
        message: `Failed to delete ${selectedRows.length} selected Elasticsearch documents`,
      });
      setError(t("dataBrowser.deleteFailed") + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
    }
  };

  return {
    confirmDeleteDoc,
    deleteSelectedDocs,
    openEdit,
    openCreateDoc,
    requestDeleteDoc,
    submitEdit,
    submitCreateDoc,
  };
}