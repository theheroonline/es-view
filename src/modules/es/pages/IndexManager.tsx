import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { logError } from "../../../lib/errorLog";
import { useElasticsearchContext } from "../../../state/ElasticsearchContext";
import {
  createEsIndex,
  deleteEsIndex,
  getEsIndexSettings,
  getEsIndexMapping,
  getEsIndexStats,
  refreshEsIndex,
  addEsIndexAlias,
  removeEsIndexAlias,
  openEsIndex,
  closeEsIndex,
  reindexEsIndices,
} from "../services/indexService";

type DetailTab = "settings" | "mapping" | "stats" | "aliases";

export default function IndexManager() {
  const { t } = useTranslation();
  const { activeConnection, selectedIndex, setSelectedIndex, refreshIndices, indicesMeta } = useElasticsearchContext();

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createBody, setCreateBody] = useState("{}");
  const [createError, setCreateError] = useState("");

  // Detail panel
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<Record<string, unknown> | null>(null);
  const [detailTarget, setDetailTarget] = useState("");
  const [detailTab, setDetailTab] = useState<DetailTab>("settings");
  const [detailAliasNames, setDetailAliasNames] = useState<string[]>([]);

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState("");
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");

  // Reindex dialog
  const [showReindex, setShowReindex] = useState(false);
  const [reindexSource, setReindexSource] = useState("");
  const [reindexDest, setReindexDest] = useState("");
  const [reindexAsync, setReindexAsync] = useState(false);
  const [reindexError, setReindexError] = useState("");
  const [reindexing, setReindexing] = useState(false);

  const [newAlias, setNewAlias] = useState("");
  const [aliasLoading, setAliasLoading] = useState(false);
  const [indexStatuses, setIndexStatuses] = useState<Record<string, "open" | "close">>({});

  const nameInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (showCreate) {
      nameInputRef.current?.focus();
    }
  }, [showCreate]);

  const loadIndices = useCallback(async () => {
    if (!activeConnection) return;
    try {
      await refreshIndices(activeConnection);
    } catch (e) {
      logError(e, { source: "indexManager.loadIndices", message: "Failed to refresh indices" });
      setError(t("indexManager.refreshFailed"));
    }
  }, [activeConnection, refreshIndices, t]);

  // Load index statuses (open/close) from _cluster/state
  useEffect(() => {
    if (!activeConnection) {
      setIndexStatuses({});
      return;
    }
    let ignore = false;
    const fetchStatuses = async () => {
      try {
        const { esRequest } = await import("../services/client");
        const data = await esRequest<any>(activeConnection, "/_cluster/state/metadata?filter_path=metadata.indices.*.state");
        const statuses: Record<string, "open" | "close"> = {};
        if (data?.metadata?.indices) {
          for (const [name, info] of Object.entries(data.metadata.indices)) {
            statuses[name] = (info as any)?.state === "close" ? "close" : "open";
          }
        }
        if (!ignore) setIndexStatuses(statuses);
      } catch {
        if (!ignore) setIndexStatuses({});
      }
    };
    fetchStatuses();
    return () => { ignore = true; };
  }, [activeConnection?.id]);

  // Load detail data on tab/index change
  useEffect(() => {
    if (!activeConnection || !detailTarget) return;

    let ignore = false;
    setDetailLoading(true);

    const loaders: Record<DetailTab, () => Promise<unknown>> = {
      settings: () => getEsIndexSettings(activeConnection, detailTarget),
      mapping: () => getEsIndexMapping(activeConnection, detailTarget),
      stats: () => getEsIndexStats(activeConnection, detailTarget),
      aliases: () => Promise.resolve(null),
    };

    Promise.all([
      loaders[detailTab](),
      loadIndexAliases(),
    ]).then(([data, aliases]) => {
      if (!ignore) {
        setDetailData(data as Record<string, unknown> | null);
        setDetailAliasNames(aliases);
      }
    }).catch((err) => {
      logError(err, { source: "indexManager.loadDetail", message: `Failed to load ${detailTab} for index ${detailTarget}` });
      if (!ignore) setDetailData(null);
    }).finally(() => {
      if (!ignore) setDetailLoading(false);
    });

    return () => { ignore = true; };
  }, [activeConnection?.id, detailTarget, detailTab]);

  async function loadIndexAliases(): Promise<string[]> {
    if (!activeConnection || !detailTarget) return [];
    try {
      const data = await esRequestAliases(activeConnection, detailTarget);
      return data.filter((a: any) => a.index === detailTarget).map((a: any) => a.alias);
    } catch {
      return [];
    }
  }

  const handleCreate = async () => {
    setCreateError("");
    if (!activeConnection) return;
    if (!createName) {
      setCreateError(t("indexManager.indexNameRequired"));
      return;
    }
    try {
      const body = createBody.trim() ? JSON.parse(createBody) : {};
      await createEsIndex(activeConnection, createName, body);
      await loadIndices();
      setCreateName("");
      setCreateBody("{}");
      setShowCreate(false);
    } catch (err) {
      logError(err, { source: "indexManager.createIndex", message: `Failed to create index ${createName}` });
      setCreateError(t("indexManager.createFailed"));
    }
  };

  const openDeleteModal = (index: string) => {
    setDeleteTarget(index);
    setDeleteConfirmInput("");
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!activeConnection || !deleteTarget) return;
    if (deleteConfirmInput !== deleteTarget) return;

    setError("");
    try {
      await deleteEsIndex(activeConnection, deleteTarget);
      await loadIndices();
      if (selectedIndex === deleteTarget) setSelectedIndex(undefined);
      if (detailTarget === deleteTarget) {
        setShowDetailPanel(false);
        setDetailTarget("");
      }
      setShowDeleteModal(false);
    } catch (err) {
      logError(err, { source: "indexManager.deleteIndex", message: `Failed to delete index ${deleteTarget}` });
      setError(t("indexManager.deleteFailed"));
    }
  };

  const handleRefresh = async (index?: string) => {
    if (!activeConnection) return;
    const target = index || detailTarget;
    if (!target) return;
    try {
      await refreshEsIndex(activeConnection, target);
      await loadIndices();
    } catch (err) {
      logError(err, { source: "indexManager.refreshIndex", message: `Failed to refresh index ${target}` });
      setError(t("indexManager.refreshFailed"));
    }
  };

  const openDetail = (index: string) => {
    if (detailTarget === index && showDetailPanel) {
      setShowDetailPanel(false);
      setDetailTarget("");
    } else {
      setDetailTarget(index);
      setShowDetailPanel(true);
    }
  };

  const handleOpenClose = async (index: string, action: "open" | "close") => {
    if (!activeConnection) return;
    try {
      if (action === "open") {
        await openEsIndex(activeConnection, index);
      } else {
        await closeEsIndex(activeConnection, index);
      }
      await loadIndices();
    } catch (err) {
      logError(err, { source: "indexManager.openClose", message: `Failed to ${action} index ${index}` });
      setError(t("indexManager.refreshFailed"));
    }
  };

  const handleAddAlias = async () => {
    if (!activeConnection || !detailTarget || !newAlias.trim()) return;
    setAliasLoading(true);
    try {
      await addEsIndexAlias(activeConnection, detailTarget, newAlias.trim());
      setNewAlias("");
      await loadIndexAliases();
    } catch (err) {
      logError(err, { source: "indexManager.addAlias", message: `Failed to add alias ${newAlias} to ${detailTarget}` });
    } finally {
      setAliasLoading(false);
    }
  };

  const handleRemoveAlias = async (alias: string) => {
    if (!activeConnection || !detailTarget) return;
    setAliasLoading(true);
    try {
      await removeEsIndexAlias(activeConnection, detailTarget, alias);
      await loadIndexAliases();
    } catch (err) {
      logError(err, { source: "indexManager.removeAlias", message: `Failed to remove alias ${alias} from ${detailTarget}` });
    } finally {
      setAliasLoading(false);
    }
  };

  const handleReindex = async () => {
    setReindexError("");
    if (!activeConnection || !reindexSource || !reindexDest) {
      setReindexError(t("indexManager.indexNameRequired"));
      return;
    }
    setReindexing(true);
    try {
      await reindexEsIndices(activeConnection, reindexSource, reindexDest, !reindexAsync);
      await loadIndices();
      setShowReindex(false);
      setReindexSource("");
      setReindexDest("");
    } catch (err) {
      logError(err, { source: "indexManager.reindex", message: `Failed to reindex ${reindexSource} -> ${reindexDest}` });
      setReindexError(t("indexManager.createFailed"));
    } finally {
      setReindexing(false);
    }
  };

  // Collect aliases across all indices for display in table
  const aliasMap = useCallback(() => {
    const map: Record<string, string[]> = {};
    indicesMeta.forEach((item) => {
      map[item.index] = item.aliases || [];
    });
    return map;
  }, [indicesMeta]);

  const allAliases = aliasMap();

  return (
    <div className="page">
      {showCreate && <CreateModal
        createName={createName}
        setCreateName={setCreateName}
        createBody={createBody}
        setCreateBody={setCreateBody}
        createError={createError}
        setShowCreate={setShowCreate}
        handleCreate={handleCreate}
        nameInputRef={nameInputRef}
      />}

      {showDeleteModal && <DeleteModal
        deleteTarget={deleteTarget}
        deleteConfirmInput={deleteConfirmInput}
        setDeleteConfirmInput={setDeleteConfirmInput}
        setShowDeleteModal={setShowDeleteModal}
        confirmDelete={confirmDelete}
      />}

      {showReindex && <ReindexModal
        indicesMeta={indicesMeta}
        reindexSource={reindexSource}
        setReindexSource={setReindexSource}
        reindexDest={reindexDest}
        setReindexDest={setReindexDest}
        reindexAsync={reindexAsync}
        setReindexAsync={setReindexAsync}
        reindexError={reindexError}
        reindexing={reindexing}
        setShowReindex={setShowReindex}
        handleReindex={handleReindex}
      />}

      <div className="master-detail-layout">
        <div className="master-pane">
           <div className="card">
              {error && (
                <div className="tm-error-banner">
                  <span className="text-danger">{error}</span>
                  <button className="btn btn-sm btn-ghost" onClick={() => setError("")}>{t("common.close")}</button>
                </div>
              )}
              <div className="card-header">
                  <h3 className="card-title">{t("indexManager.title")}</h3>
                  {activeConnection && (
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => setShowReindex(true)} title={t("indexManager.reindex")}>
                        {t("indexManager.reindex")}
                      </button>
                      <button className={`btn btn-sm ${showCreate ? "btn-secondary" : "btn-primary"}`} onClick={() => setShowCreate(!showCreate)}>
                        {showCreate ? t("indexManager.cancelCreate") : t("indexManager.createIndex")}
                      </button>
                    </div>
                  )}
              </div>

              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("indexManager.indexName")}</th>
                      <th style={{ width: "80px" }}>{t("indexManager.status")}</th>
                      <th style={{ width: "100px" }}>{t("indexManager.health")}</th>
                      <th style={{ width: "100px" }}>{t("indexManager.docsCount")}</th>
                      <th style={{ minWidth: "120px" }}>{t("indexManager.aliases")}</th>
                      <th style={{ width: "280px", textAlign: "right" }}>{t("indexManager.operations")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indicesMeta.map((item) => {
                      const status = indexStatuses[item.index] ?? "open";
                      const aliases = allAliases[item.index] || [];
                      return (
                        <tr key={item.index} style={{ background: detailTarget === item.index && showDetailPanel ? "#f1f5f9" : undefined }}>
                          <td style={{ fontWeight: 500 }}>
                            {item.index}
                            {selectedIndex === item.index && <span style={{ marginLeft: "8px", fontSize: "11px", background: "rgba(0, 122, 255, 0.1)", color: "#007aff", padding: "2px 6px", borderRadius: "4px" }}>{t("indexManager.selected")}</span>}
                          </td>
                          <td>
                            {status === "close" ? (
                              <span style={{ fontSize: "11px", background: "#f1f5f9", color: "#64748b", padding: "2px 6px", borderRadius: "4px" }}>closed</span>
                            ) : (
                              <span style={{ fontSize: "11px", background: "#f0fdf4", color: "#16a34a", padding: "2px 6px", borderRadius: "4px" }}>open</span>
                            )}
                          </td>
                          <td>
                             <span style={{
                               display: "inline-block",
                               width: "8px",
                               height: "8px",
                               borderRadius: "50%",
                               background: item.health === "green" ? "#34c759" : item.health === "yellow" ? "#ff9500" : "#ff3b30",
                               marginRight: "8px"
                             }}></span>
                             <span style={{ textTransform: "capitalize", fontSize: "12px", color: "#86868b" }}>{item.health}</span>
                          </td>
                          <td>{item.docsCount}</td>
                          <td>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "2px" }}>
                              {aliases.length > 0 ? aliases.map((a) => (
                                <span key={a} style={{ fontSize: "10px", background: "#f0f4ff", color: "#4a6cf7", padding: "1px 5px", borderRadius: "3px" }}>{a}</span>
                              )) : <span className="muted" style={{ fontSize: "11px" }}>-</span>}
                            </div>
                          </td>
                          <td className="table-actions" style={{ textAlign: "right" }}>
                            <div className="flex-gap justify-end" style={{ gap: "4px" }}>
                               {status === "close" ? (
                                 <button className="btn btn-sm btn-ghost" onClick={() => handleOpenClose(item.index, "open")} title={t("indexManager.openIndex")}>{t("indexManager.openIndex")}</button>
                               ) : (
                                 <button className="btn btn-sm btn-ghost" onClick={() => handleOpenClose(item.index, "close")} title={t("indexManager.closeIndex")}>{t("indexManager.closeIndex")}</button>
                               )}
                               <button className="btn btn-sm btn-ghost" onClick={() => openDetail(item.index)} title={t("indexManager.details")}>{t("indexManager.details")}</button>
                               <button className="btn btn-sm btn-ghost text-danger" onClick={() => openDeleteModal(item.index)} title={t("common.delete")}>{t("common.delete")}</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {indicesMeta.length === 0 && (
                      <tr>
                        <td colSpan={6} className="muted" style={{ textAlign: "center", padding: "32px" }}>
                          {activeConnection ? t("indexManager.noIndices") : t("indexManager.notConnected")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
           </div>
        </div>

        <div className={`detail-pane ${showDetailPanel ? "open" : ""}`}>
           <div className="detail-header">
              <h3 className="card-title">{t("indexManager.indexDetails")}: {detailTarget}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowDetailPanel(false)}>&#x2715;</button>
           </div>

           {/* Detail tabs */}
           <div style={{ display: "flex", gap: "0", borderBottom: "1px solid #e2e8f0", padding: "0 16px" }}>
             {(["settings", "mapping", "stats", "aliases"] as DetailTab[]).map((tab) => (
               <button
                 key={tab}
                 className="btn btn-sm btn-ghost"
                 style={{
                   borderBottom: detailTab === tab ? "2px solid #007aff" : "2px solid transparent",
                   borderRadius: 0,
                   fontWeight: detailTab === tab ? 600 : 400,
                   color: detailTab === tab ? "#007aff" : "#64748b",
                   padding: "8px 16px",
                 }}
                 onClick={() => setDetailTab(tab)}
               >
                 {tab === "settings" ? t("indexManager.settingsTab") :
                  tab === "mapping" ? t("indexManager.mappingTab") :
                  tab === "stats" ? t("indexManager.statsTab") :
                  t("indexManager.aliasesTab")}
               </button>
             ))}
           </div>

           <div className="detail-content" style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "0" }}>
              {detailLoading && <div style={{ padding: "24px", color: "#86868b", fontSize: "13px" }}>{t("common.loading")}</div>}
              {!detailLoading && detailTab === "aliases" && (
                <div style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                    <input
                      className="form-control"
                      value={newAlias}
                      onChange={(e) => setNewAlias(e.target.value)}
                      placeholder={t("indexManager.newAliasPlaceholder")}
                      style={{ flex: 1 }}
                    />
                    <button className="btn btn-sm btn-primary" onClick={handleAddAlias} disabled={aliasLoading || !newAlias.trim()}>
                      {t("indexManager.addAlias")}
                    </button>
                  </div>
                  {detailAliasNames.length === 0 ? (
                    <p className="muted" style={{ fontSize: "13px" }}>{t("indexManager.noAliases")}</p>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {detailAliasNames.map((a) => (
                        <span key={a} style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", background: "#f0f4ff", color: "#4a6cf7", padding: "4px 8px", borderRadius: "6px" }}>
                          {a}
                          <button className="btn btn-sm btn-ghost" style={{ padding: "0 2px", fontSize: "14px", lineHeight: 1 }} onClick={() => handleRemoveAlias(a)} title={t("indexManager.removeAlias")}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!detailLoading && detailTab !== "aliases" && detailData && (
                 <pre style={{
                    margin: 0,
                    padding: "20px",
                    fontSize: "12px",
                    fontFamily: '"SF Mono", Menlo, monospace',
                    overflow: "auto",
                    background: "#fbfbfd",
                    color: "#1d1d1f",
                    lineHeight: "1.6"
                 }}>
                    {JSON.stringify(detailData, null, 2)}
                 </pre>
              )}
           </div>

           <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(0,0,0,0.05)", background: "#fff", display: "flex", gap: "6px" }}>
              <button className="btn btn-sm btn-secondary" style={{ flex: 1 }} onClick={() => { handleRefresh(); }}>{t("indexManager.refreshStatus")}</button>
           </div>
        </div>
      </div>
    </div>
  );
}

// -- Sub-components to keep main component manageable --

function CreateModal({
  createName, setCreateName, createBody, setCreateBody, createError,
  setShowCreate, handleCreate, nameInputRef,
}: {
  createName: string; setCreateName: (v: string) => void;
  createBody: string; setCreateBody: (v: string) => void;
  createError: string; setShowCreate: (v: boolean) => void;
  handleCreate: () => void; nameInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const { t } = useTranslation();
  return (
    <div className="modal-overlay" onClick={() => setShowCreate(false)}>
      <div className="card anim-fade-in es-create-index-modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-header">
          <h3 className="card-title">{t("indexManager.newIndex")}</h3>
          <button className="btn btn-ghost btn-icon" onClick={() => setShowCreate(false)}>&#x2715;</button>
        </div>
        <div className="card-body">
          <div style={{ marginBottom: "16px" }}>
            <label>{t("indexManager.indexName")}</label>
            <input
              ref={nameInputRef}
              className="form-control"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder={t("indexManager.namePlaceholder")}
            />
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label>{t("indexManager.configuration")}</label>
            <textarea className="json-editor" value={createBody} onChange={(e) => setCreateBody(e.target.value)} rows={10} />
          </div>
          {createError && <p className="text-danger" style={{ marginBottom: "12px" }}>{createError}</p>}
          <div className="flex-gap justify-end">
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>{t("common.cancel")}</button>
            <button className="btn btn-primary" onClick={handleCreate}>{t("indexManager.confirmCreate")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({
  deleteTarget, deleteConfirmInput, setDeleteConfirmInput,
  setShowDeleteModal, confirmDelete,
}: {
  deleteTarget: string; deleteConfirmInput: string; setDeleteConfirmInput: (v: string) => void;
  setShowDeleteModal: (v: boolean) => void; confirmDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.2)", backdropFilter: "blur(4px)",
      WebkitBackdropFilter: "blur(4px)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <div className="card anim-fade-in" style={{ width: "400px", boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)", border: "none" }}>
         <div className="card-header">
            <h3 className="card-title text-danger">{t("indexManager.deleteConfirm")}</h3>
         </div>
         <div className="card-body">
            <p>{t("indexManager.deleting")} <strong>{deleteTarget}</strong></p>
            <p className="text-secondary" style={{ fontSize: "13px", marginBottom: "16px" }}>
               {t("indexManager.deleteWarning")}
            </p>
            <input
               className="form-control"
               value={deleteConfirmInput}
               onChange={(e) => setDeleteConfirmInput(e.target.value)}
               placeholder={deleteTarget}
               style={{ marginBottom: "16px" }}
            />
            <div className="flex-gap justify-end">
               <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>{t("common.cancel")}</button>
               <button
                 className="btn btn-primary"
                 style={{ background: "#ef4444", borderColor: "#ef4444" }}
                 disabled={deleteConfirmInput !== deleteTarget}
                 onClick={confirmDelete}
               >
                 {t("indexManager.confirmDelete")}
               </button>
            </div>
         </div>
      </div>
    </div>
  );
}

function ReindexModal({
  indicesMeta, reindexSource, setReindexSource, reindexDest, setReindexDest,
  reindexAsync, setReindexAsync, reindexError, reindexing, setShowReindex, handleReindex,
}: {
  indicesMeta: Array<{ index: string }>;
  reindexSource: string; setReindexSource: (v: string) => void;
  reindexDest: string; setReindexDest: (v: string) => void;
  reindexAsync: boolean; setReindexAsync: (v: boolean) => void;
  reindexError: string; reindexing: boolean;
  setShowReindex: (v: boolean) => void; handleReindex: () => void;
}) {
  const { t } = useTranslation();
  const nonSystemIndices = indicesMeta.filter((i) => !i.index.startsWith("."));
  return (
    <div className="modal-overlay" onClick={() => setShowReindex(false)}>
      <div className="card anim-fade-in" style={{ width: "440px" }} onClick={(e) => e.stopPropagation()}>
        <div className="card-header">
          <h3 className="card-title">{t("indexManager.reindex")}</h3>
          <button className="btn btn-ghost btn-icon" onClick={() => setShowReindex(false)}>&#x2715;</button>
        </div>
        <div className="card-body">
          <div style={{ marginBottom: "12px" }}>
            <label>{t("indexManager.reindexSource")}</label>
            <select className="form-control" value={reindexSource} onChange={(e) => setReindexSource(e.target.value)}>
              <option value="">{t("indexManager.selectIndex")}</option>
              {nonSystemIndices.map((i) => <option key={i.index} value={i.index}>{i.index}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label>{t("indexManager.reindexDest")}</label>
            <input
              className="form-control"
              value={reindexDest}
              onChange={(e) => setReindexDest(e.target.value)}
              placeholder={t("indexManager.reindexDestPlaceholder")}
            />
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input type="checkbox" checked={reindexAsync} onChange={(e) => setReindexAsync(e.target.checked)} />
              <span style={{ fontSize: "13px" }}>{t("indexManager.reindexAsync")}</span>
            </label>
          </div>
          {reindexError && <p className="text-danger" style={{ marginBottom: "12px" }}>{reindexError}</p>}
          <div className="flex-gap justify-end">
            <button className="btn btn-secondary" onClick={() => setShowReindex(false)}>{t("common.cancel")}</button>
            <button className="btn btn-primary" onClick={handleReindex} disabled={reindexing || !reindexSource || !reindexDest}>
              {reindexing ? t("indexManager.reindexing") : t("indexManager.reindex")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Thin wrappers to avoid import cycles
async function esRequestAliases(connection: any, index: string) {
  const { esRequest } = await import("../services/client");
  return esRequest<any>(connection, `/_cat/aliases/${encodeURIComponent(index)}?format=json`);
}
