import type { TFunction } from "i18next";

type SearchRow = {
  _id: string;
  _index: string;
  _source?: Record<string, unknown>;
};

interface DeleteConfirmDialogState {
  docIndex: string;
  docId: string;
}

interface EsDataBrowserDialogsProps {
  deleteConfirmDialog: DeleteConfirmDialogState | null;
  editJson: string;
  editingDoc: SearchRow | null;
  error: string;
  showEditModal: boolean;
  t: TFunction;
  onChangeEditJson: (value: string) => void;
  onCloseDeleteDialog: () => void;
  onCloseEditModal: () => void;
  onConfirmDelete: (docIndex: string, docId: string) => void;
  onSubmitEdit: () => void;
}

export function EsDataBrowserDialogs({
  deleteConfirmDialog,
  editJson,
  editingDoc,
  error,
  showEditModal,
  t,
  onChangeEditJson,
  onCloseDeleteDialog,
  onCloseEditModal,
  onConfirmDelete,
  onSubmitEdit,
}: EsDataBrowserDialogsProps) {
  return (
    <>
      {showEditModal && editingDoc && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={onCloseEditModal}
        >
          <div className="card anim-fade-in" style={{ width: "600px", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }} onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h3 className="card-title">{t("dataBrowser.editDocument", { id: editingDoc._id })}</h3>
            </div>
            <div className="card-body" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "12px", color: "#64748b" }}>{t("dataBrowser.index")}: {editingDoc._index}</label>
              </div>
              <textarea
                className="json-editor"
                style={{ flex: 1, minHeight: "300px" }}
                value={editJson}
                onChange={(event) => onChangeEditJson(event.target.value)}
              />
              {error && <p className="text-danger" style={{ marginTop: "8px" }}>{error}</p>}
              <div className="flex-gap justify-end" style={{ marginTop: "16px" }}>
                <button className="btn btn-secondary" onClick={onCloseEditModal}>{t("common.cancel")}</button>
                <button className="btn btn-primary" onClick={onSubmitEdit}>{t("common.save")}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmDialog && (
        <div className="modal-overlay" onClick={onCloseDeleteDialog}>
          <div className="card modal-card modal-card-sm modal-card-scroll" onClick={(event) => event.stopPropagation()}>
            <div className="card-header page-section-header">
              <h3 className="card-title">{t("dataBrowser.deleteConfirm", { docId: deleteConfirmDialog.docId })}</h3>
              <button className="btn btn-sm btn-ghost" onClick={onCloseDeleteDialog}>
                {t("common.close")}
              </button>
            </div>
            <div className="modal-card-body">
              <p style={{ margin: 0, color: "#ef4444", fontSize: "14px" }}>
                {t("dataBrowser.deleteWarning", { docId: deleteConfirmDialog.docId })}
              </p>
            </div>
            <div className="modal-card-footer">
              <button className="btn btn-sm btn-ghost" onClick={onCloseDeleteDialog}>
                {t("common.cancel")}
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => onConfirmDelete(deleteConfirmDialog.docIndex, deleteConfirmDialog.docId)}
              >
                {t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}