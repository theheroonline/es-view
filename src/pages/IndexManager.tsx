import { useEffect, useMemo, useState } from "react";
import { createIndex, deleteIndex, getIndexInfo, refreshIndex } from "../lib/esView";
import { useAppContext } from "../state/AppContext";

export default function IndexManager() {
  const { getActiveConnection, selectedIndex, setSelectedIndex, refreshIndices, indicesMeta } = useAppContext();
  const activeConnection = useMemo(() => getActiveConnection(), [getActiveConnection]);
  
  // Creation States
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createBody, setCreateBody] = useState("{}");
  const [error, setError] = useState("");

  // Detail View States
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailTarget, setDetailTarget] = useState<string>("");

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState("");
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");

  const loadIndices = async () => {
    if (!activeConnection) return;
    try {
      await refreshIndices(activeConnection);
    } catch (e) {
      console.error(e);
    }
  };

  // Load details when target changes
  useEffect(() => {
    if (!activeConnection || !detailTarget) return;

    setDetailLoading(true);
    getIndexInfo(activeConnection, detailTarget)
      .then((info) => {
        setDetailData(info);
      })
      .catch(() => {
        setDetailData(null);
      })
      .finally(() => {
        setDetailLoading(false);
      });
  }, [activeConnection, detailTarget]);

  const handleCreate = async () => {
    setError("");
    if (!activeConnection) return;
    if (!createName) {
      setError("请输入索引名称");
      return;
    }
    try {
      const body = createBody.trim() ? JSON.parse(createBody) : {};
      await createIndex(activeConnection, createName, body);
      await loadIndices();
      setCreateName("");
      setCreateBody("{}");
      setShowCreate(false); 
    } catch {
      setError("创建失败，请检查 JSON 格式");
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
      await deleteIndex(activeConnection, deleteTarget);
      await loadIndices();
      if (selectedIndex === deleteTarget) {
        setSelectedIndex(undefined);
      }
      if (detailTarget === deleteTarget) {
        setShowDetailPanel(false);
        setDetailTarget("");
      }
      setShowDeleteModal(false);
    } catch {
      setError("删除失败");
    }
  };

  const handleRefresh = async (index: string) => {
    if (!activeConnection) return;
    try {
      await refreshIndex(activeConnection, index);
      await loadIndices(); // reload to get new counts
    } catch {
      setError("刷新失败");
    }
  };

  const openDetail = (index: string) => {
    if (detailTarget === index && showDetailPanel) {
      // Toggle off if clicking same
      setShowDetailPanel(false);
      setDetailTarget("");
    } else {
      setDetailTarget(index);
      setShowDetailPanel(true);
    }
  };

  return (
    <div className="page">
      {/* Create Section */}
      {showCreate && (
        <div className="card anim-fade-in">
          <div className="card-header">
            <h3 className="card-title">新建索引</h3>
          </div>
          <div className="card-body">
            <div className="form-grid" style={{ maxWidth: '800px' }}>
              <div>
                <label>索引名称</label>
                <input 
                  className="form-control"
                  value={createName} 
                  onChange={(event) => setCreateName(event.target.value)} 
                  placeholder="例如: logs-2024"
                />
              </div>
              <div className="span-2">
                <label>配置 (Mappings/Settings JSON)</label>
                <textarea 
                  className="json-editor"
                  value={createBody} 
                  onChange={(event) => setCreateBody(event.target.value)} 
                />
              </div>
              <div className="span-2">
                 <button className="btn btn-primary" onClick={handleCreate}>确认创建</button>
              </div>
            </div>
            {error && <p className="text-danger" style={{ marginTop: '12px' }}>{error}</p>}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.2)', 
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card anim-fade-in" style={{ width: '400px', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)', border: 'none' }}>
             <div className="card-header">
                <h3 className="card-title text-danger">删除索引确认</h3>
             </div>
             <div className="card-body">
                <p>正在删除索引 <strong>{deleteTarget}</strong></p>
                <p className="text-secondary" style={{ fontSize: '13px', marginBottom: '16px' }}>
                   此操作不可恢复。请输入索引名称以确认删除。
                </p>
                <input 
                   className="form-control" 
                   value={deleteConfirmInput}
                   onChange={(e) => setDeleteConfirmInput(e.target.value)}
                   placeholder={deleteTarget}
                   style={{ marginBottom: '16px' }}
                />
                <div className="flex-gap justify-end">
                   <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>取消</button>
                   <button 
                     className="btn btn-primary" 
                     style={{ background: '#ef4444', borderColor: '#ef4444' }}
                     disabled={deleteConfirmInput !== deleteTarget}
                     onClick={confirmDelete}
                   >
                     确认删除
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div className="master-detail-layout">
        <div className="master-pane">
           <div className="card">
              <div className="card-header">
                  <h3 className="card-title">索引列表</h3>
                  {activeConnection && (
                      <button className={`btn btn-sm ${showCreate ? "btn-secondary" : "btn-primary"}`} onClick={() => setShowCreate(!showCreate)}>
                        {showCreate ? "取消创建" : "+ 创建索引"}
                      </button>
                  )}
              </div>
              
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>索引名称</th>
                      <th style={{ width: '100px' }}>健康</th>
                      <th style={{ width: '100px' }}>文档数</th>
                      <th style={{ width: '220px', textAlign: 'right' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indicesMeta.map((item) => (
                      <tr key={item.index} style={{ background: detailTarget === item.index && showDetailPanel ? '#f1f5f9' : undefined }}>
                        <td style={{ fontWeight: 500 }}>
                          {item.index} 
                          {selectedIndex === item.index && <span style={{ marginLeft: '8px', fontSize: '11px', background: 'rgba(0, 122, 255, 0.1)', color: '#007aff', padding: '2px 6px', borderRadius: '4px' }}>当前</span>}
                        </td>
                        <td>
                           <span style={{ 
                             display: 'inline-block', 
                             width: '8px', 
                             height: '8px', 
                             borderRadius: '50%', 
                             background: item.health === 'green' ? '#34c759' : item.health === 'yellow' ? '#ff9500' : '#ff3b30',
                             marginRight: '8px'
                           }}></span>
                           <span style={{ textTransform: 'capitalize', fontSize: '12px', color: '#86868b' }}>{item.health}</span>
                        </td>
                        <td>{item.docsCount}</td>
                        <td className="table-actions" style={{ textAlign: 'right' }}>
                          <div className="flex-gap justify-end" style={{ gap: '4px' }}>
                             <button className="btn btn-sm btn-ghost" onClick={() => openDetail(item.index)} title="查看详情">详情</button>
                             <button className="btn btn-sm btn-ghost text-danger" onClick={() => openDeleteModal(item.index)} title="删除索引">删除</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {indicesMeta.length === 0 && (
                      <tr>
                        <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: '32px' }}>
                          {activeConnection ? "未找到索引" : "请先连接 Elasticsearch"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
           </div>
        </div>

        {/* Right Detail Panel */}
        <div className={`detail-pane ${showDetailPanel ? 'open' : ''}`}>
           <div className="detail-header">
              <h3 className="card-title">索引详情: {detailTarget}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowDetailPanel(false)}>✕</button>
           </div>
           
           <div className="detail-content" style={{ padding: '0' }}>
              {detailLoading && <div style={{ padding: '24px', color: '#86868b', fontSize: '13px' }}>加载中...</div>}
              {!detailLoading && detailData && (
                 <pre style={{ 
                    margin: 0, 
                    padding: '20px', 
                    fontSize: '12px', 
                    fontFamily: '"SF Mono", Menlo, monospace', 
                    overflow: 'auto',
                    background: '#fbfbfd',
                    color: '#1d1d1f',
                    lineHeight: '1.6'
                 }}>
                    {JSON.stringify(detailData, null, 2)}
                 </pre>
              )}
           </div>
           
           <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(0,0,0,0.05)', background: '#fff' }}>
              <button className="btn btn-sm btn-secondary" style={{ width: '100%' }} onClick={() => handleRefresh(detailTarget)}>🔄 刷新状态</button>
           </div>
        </div>
      </div>

    </div>
  );
}
