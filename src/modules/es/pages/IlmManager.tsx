import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { logError } from "../../../lib/errorLog";
import { useElasticsearchContext } from "../../../state/ElasticsearchContext";
import { listEsIlmPolicies, deleteEsIlmPolicy, getEsIlmExplain } from "../services/ilmService";

export default function IlmManager() {
  const { t } = useTranslation();
  const { activeConnection, esVersion } = useElasticsearchContext();

  const [policies, setPolicies] = useState<Array<{ name: string; phases: number; raw: any }>>([]);
  const [ilmExplain, setIlmExplain] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Create/Edit dialog
  const [showDialog, setShowDialog] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBody, setEditBody] = useState("{}");
  const [dialogError, setDialogError] = useState("");
  const [isEdit, setIsEdit] = useState(false);

  // View ILM explain
  const [showIlmExplain, setShowIlmExplain] = useState(false);
  const [selectedPolicyForExplain, setSelectedPolicyForExplain] = useState("");

  const loadPolicies = useCallback(async () => {
    if (!activeConnection) return;
    setLoading(true);
    setError("");
    try {
      const data = await listEsIlmPolicies(activeConnection);
      const list = Object.entries(data || {}).map(([name, raw]: [string, any]) => ({
        name,
        phases: Object.keys(raw?.policy?.phases || {}).length,
        raw,
      }));
      setPolicies(list);
    } catch (err) {
      logError(err, { source: "ilmManager.loadPolicies", message: "Failed to load ILM policies" });
      setError(t("ilmManager.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [activeConnection, t]);

  const loadIlmExplain = useCallback(async (_policy?: string) => {
    if (!activeConnection) return;
    try {
      const data = await getEsIlmExplain(activeConnection, "*");
      setIlmExplain(data?.indices || {});
    } catch (err) {
      logError(err, { source: "ilmManager.loadIlmExplain", message: "Failed to load ILM explain" });
    }
  }, [activeConnection]);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  const openCreate = () => {
    setIsEdit(false);
    setEditName("");
    setEditBody(JSON.stringify({ phases: { hot: { actions: {} } } }, null, 2));
    setDialogError("");
    setShowDialog(true);
  };

  const openEdit = (name: string, raw: any) => {
    setIsEdit(true);
    setEditName(name);
    // Extract the policy body (without metadata)
    const policyBody = raw?.policy || raw;
    setEditBody(JSON.stringify(policyBody, null, 2));
    setDialogError("");
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!activeConnection || !editName) return;
    setDialogError("");
    try {
      const body = editBody.trim() ? JSON.parse(editBody) : {};
      const { esRequest } = await import("../services/client");
      await esRequest<any>(activeConnection, `/_ilm/policy/${encodeURIComponent(editName)}`, {
        method: "PUT",
        body: { policy: body },
      });
      setShowDialog(false);
      await loadPolicies();
    } catch (err) {
      logError(err, { source: "ilmManager.save", message: `Failed to save ILM policy ${editName}` });
      setDialogError(t("ilmManager.saveFailed"));
    }
  };

  const handleDelete = async (name: string) => {
    if (!activeConnection) return;
    try {
      await deleteEsIlmPolicy(activeConnection, name);
      await loadPolicies();
    } catch (err) {
      logError(err, { source: "ilmManager.delete", message: `Failed to delete ILM policy ${name}` });
      setError(t("ilmManager.deleteFailed"));
    }
  };

  const isV6 = esVersion ? parseInt(esVersion.number) === 6 : false;

  const filteredIndices = selectedPolicyForExplain
    ? Object.entries(ilmExplain).filter(([, info]: [string, any]) => info?.policy === selectedPolicyForExplain)
    : Object.entries(ilmExplain);

  return (
    <div className="page">
      {showDialog && (
        <div className="modal-overlay" onClick={() => setShowDialog(false)}>
          <div className="card anim-fade-in" style={{ width: "600px", maxWidth: "90vw" }} onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h3 className="card-title">{isEdit ? t("ilmManager.editPolicy") : t("ilmManager.newPolicy")}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowDialog(false)}>&#x2715;</button>
            </div>
            <div className="card-body">
              <div style={{ marginBottom: "12px" }}>
                <label>{t("ilmManager.policyName")}</label>
                <input
                  className="form-control"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={t("ilmManager.namePlaceholder")}
                  disabled={isEdit}
                />
              </div>
              <div>
                <label>{t("ilmManager.configuration")}</label>
                <textarea className="json-editor" value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={16} />
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

      {isV6 && (
        <div style={{ padding: "16px", background: "#fef3c7", color: "#92400e", fontSize: "13px", borderRadius: "8px", marginBottom: "16px" }}>
          {t("ilmManager.v6Warning")}
        </div>
      )}

      <div className="card" style={{ marginBottom: "16px" }}>
        <div className="card-header">
          <h3 className="card-title">{t("ilmManager.policies")}</h3>
          <div style={{ display: "flex", gap: "6px" }}>
            {activeConnection && !isV6 && (
              <button className="btn btn-sm btn-secondary" onClick={() => { loadIlmExplain(); setShowIlmExplain(!showIlmExplain); }}>
                {t("ilmManager.indexUsage")}
              </button>
            )}
            {activeConnection && !isV6 && (
              <button className="btn btn-sm btn-primary" onClick={openCreate}>
                {t("ilmManager.newPolicy")}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="tm-error-banner">
            <span className="text-danger">{error}</span>
            <button className="btn btn-sm btn-ghost" onClick={() => setError("")}>{t("common.close")}</button>
          </div>
        )}

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>{t("ilmManager.policyName")}</th>
                <th style={{ width: "120px" }}>{t("ilmManager.phases")}</th>
                <th style={{ width: "200px", textAlign: "right" }}>{t("indexManager.operations")}</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((policy) => (
                <tr key={policy.name}>
                  <td style={{ fontWeight: 500 }}>{policy.name}</td>
                  <td>{policy.phases}</td>
                  <td className="table-actions" style={{ textAlign: "right" }}>
                    <div className="flex-gap justify-end" style={{ gap: "4px" }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => openEdit(policy.name, policy.raw)}>{t("ilmManager.edit")}</button>
                      <button className="btn btn-sm btn-ghost text-danger" onClick={() => handleDelete(policy.name)}>{t("common.delete")}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {policies.length === 0 && !loading && (
                <tr>
                  <td colSpan={3} className="muted" style={{ textAlign: "center", padding: "32px" }}>
                    {activeConnection ? isV6 ? t("ilmManager.v6Warning") : t("ilmManager.noPolicies") : t("indexManager.notConnected")}
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

      {showIlmExplain && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{t("ilmManager.indexUsage")}</h3>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <select
                className="form-control"
                value={selectedPolicyForExplain}
                onChange={(e) => setSelectedPolicyForExplain(e.target.value)}
                style={{ width: "200px" }}
              >
                <option value="">{t("ilmManager.allPolicies")}</option>
                {policies.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
              <button className="btn btn-sm btn-ghost" onClick={() => loadIlmExplain(selectedPolicyForExplain || undefined)}>
                {t("indexManager.refreshStatus")}
              </button>
            </div>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("indexManager.indexName")}</th>
                  <th>{t("ilmManager.policy")}</th>
                  <th>{t("ilmManager.phase")}</th>
                  <th>{t("ilmManager.action")}</th>
                  <th>{t("ilmManager.step")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredIndices.map(([name, info]: [string, any]) => (
                  <tr key={name}>
                    <td style={{ fontWeight: 500 }}>{name}</td>
                    <td>{info?.policy || "-"}</td>
                    <td>{info?.phase || "-"}</td>
                    <td>{info?.action || "-"}</td>
                    <td>{info?.step || "-"}</td>
                  </tr>
                ))}
                {filteredIndices.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted" style={{ textAlign: "center", padding: "24px" }}>
                      {t("ilmManager.noIndicesUsingIlm")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
