import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { logError } from "../../../lib/errorLog";
import { useElasticsearchContext } from "../../../state/ElasticsearchContext";
import { listEsTemplates, getEsTemplate, createEsTemplate, deleteEsTemplate } from "../services/templateService";

export default function TemplateManager() {
  const { t } = useTranslation();
  const { activeConnection, esVersion } = useElasticsearchContext();

  const [templates, setTemplates] = useState<Array<{ name: string; type: "legacy" | "composable" }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Edit/Create dialog
  const [showDialog, setShowDialog] = useState(false);
  const [editType, setEditType] = useState<"legacy" | "composable">("composable");
  const [editName, setEditName] = useState("");
  const [editBody, setEditBody] = useState("{}");
  const [dialogError, setDialogError] = useState("");
  const [isEdit, setIsEdit] = useState(false);

  const loadTemplates = useCallback(async () => {
    if (!activeConnection) return;
    setLoading(true);
    setError("");
    try {
      const data = await listEsTemplates(activeConnection);
      setTemplates(data);
    } catch (err) {
      logError(err, { source: "templateManager.loadTemplates", message: "Failed to load templates" });
      setError(t("templateManager.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [activeConnection, t]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const openEdit = async (name: string, type: "legacy" | "composable") => {
    if (!activeConnection) return;
    try {
      const data = await getEsTemplate(activeConnection, name, type);
      setIsEdit(true);
      setEditName(name);
      setEditType(type);
      // Extract the body from the response
      if (type === "composable") {
        const tpl = data?.index_templates?.[0]?.index_template;
        setEditBody(tpl ? JSON.stringify(tpl, null, 2) : JSON.stringify(data, null, 2));
      } else {
        const tpl = data?.[name];
        setEditBody(tpl ? JSON.stringify(tpl, null, 2) : JSON.stringify(data, null, 2));
      }
      setShowDialog(true);
    } catch (err) {
      logError(err, { source: "templateManager.openEdit", message: `Failed to load template ${name}` });
    }
  };

  const openCreate = () => {
    setIsEdit(false);
    setEditName("");
    setEditType(esVersion && parseInt(esVersion.number) >= 8 ? "composable" : "composable");
    setEditBody("{}");
    setDialogError("");
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!activeConnection || !editName) return;
    setDialogError("");
    try {
      const body = editBody.trim() ? JSON.parse(editBody) : {};
      await createEsTemplate(activeConnection, editName, editType, body);
      setShowDialog(false);
      await loadTemplates();
    } catch (err) {
      logError(err, { source: "templateManager.save", message: `Failed to save template ${editName}` });
      setDialogError(t("templateManager.saveFailed"));
    }
  };

  const handleDelete = async (name: string, type: "legacy" | "composable") => {
    if (!activeConnection) return;
    try {
      await deleteEsTemplate(activeConnection, name, type);
      await loadTemplates();
    } catch (err) {
      logError(err, { source: "templateManager.delete", message: `Failed to delete template ${name}` });
      setError(t("templateManager.deleteFailed"));
    }
  };

  const isV6 = esVersion ? parseInt(esVersion.number) === 6 : false;

  return (
    <div className="page">
      {showDialog && (
        <div className="modal-overlay" onClick={() => setShowDialog(false)}>
          <div className="card anim-fade-in" style={{ width: "600px", maxWidth: "90vw" }} onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h3 className="card-title">{isEdit ? t("templateManager.editTemplate") : t("templateManager.newTemplate")}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowDialog(false)}>&#x2715;</button>
            </div>
            <div className="card-body">
              <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
                <div style={{ flex: 1 }}>
                  <label>{t("templateManager.templateName")}</label>
                  <input
                    className="form-control"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder={t("templateManager.namePlaceholder")}
                    disabled={isEdit}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label>{t("templateManager.templateType")}</label>
                  <select
                    className="form-control"
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as "legacy" | "composable")}
                    disabled={isEdit}
                  >
                    <option value="composable">{t("templateManager.composable")}</option>
                    {!isV6 && <option value="legacy">{t("templateManager.legacy")}</option>}
                  </select>
                </div>
              </div>
              <div>
                <label>{t("templateManager.configuration")}</label>
                <textarea className="json-editor" value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={14} />
              </div>
              {dialogError && <p className="text-danger" style={{ marginTop: "8px" }}>{dialogError}</p>}
              <div className="flex-gap justify-end" style={{ marginTop: "12px" }}>
                <button className="btn btn-secondary" onClick={() => setShowDialog(false)}>{t("common.cancel")}</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={!editName}>{t("common.save")}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">{t("templateManager.title")}</h3>
          {activeConnection && (
            <button className="btn btn-sm btn-primary" onClick={openCreate}>
              {t("templateManager.newTemplate")}
            </button>
          )}
        </div>

        {error && (
          <div className="tm-error-banner">
            <span className="text-danger">{error}</span>
            <button className="btn btn-sm btn-ghost" onClick={() => setError("")}>{t("common.close")}</button>
          </div>
        )}

        {isV6 && (
          <div style={{ padding: "8px 16px", background: "#fef3c7", color: "#92400e", fontSize: "12px", borderRadius: "6px", margin: "0 16px 12px" }}>
            {t("templateManager.v6Warning")}
          </div>
        )}

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>{t("templateManager.templateName")}</th>
                <th style={{ width: "140px" }}>{t("templateManager.templateType")}</th>
                <th style={{ width: "160px", textAlign: "right" }}>{t("indexManager.operations")}</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((tpl) => (
                <tr key={`${tpl.type}-${tpl.name}`}>
                  <td style={{ fontWeight: 500 }}>{tpl.name}</td>
                  <td>
                    <span style={{
                      fontSize: "11px",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      background: tpl.type === "composable" ? "#f0f4ff" : "#f1f5f9",
                      color: tpl.type === "composable" ? "#4a6cf7" : "#64748b",
                    }}>
                      {tpl.type === "composable" ? t("templateManager.composable") : t("templateManager.legacy")}
                    </span>
                  </td>
                  <td className="table-actions" style={{ textAlign: "right" }}>
                    <div className="flex-gap justify-end" style={{ gap: "4px" }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => openEdit(tpl.name, tpl.type)}>{t("templateManager.edit")}</button>
                      <button className="btn btn-sm btn-ghost text-danger" onClick={() => handleDelete(tpl.name, tpl.type)}>{t("common.delete")}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && !loading && (
                <tr>
                  <td colSpan={3} className="muted" style={{ textAlign: "center", padding: "32px" }}>
                    {activeConnection ? t("templateManager.noTemplates") : t("indexManager.notConnected")}
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={3} className="muted" style={{ textAlign: "center", padding: "32px" }}>{t("common.loading")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
