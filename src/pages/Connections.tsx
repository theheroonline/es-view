import { useState } from "react";
import { pingCluster } from "../lib/esView";
import type { AuthType, ConnectionProfile } from "../lib/types";
import { useAppContext } from "../state/AppContext";

const emptyForm = {
  id: "",
  name: "",
  baseUrl: "",
  authType: "none" as AuthType,
  username: "",
  password: "",
  apiKey: "",
  verifyTls: true
};

export default function Connections() {
  const { state, saveConnection, deleteConnection, setActiveConnection, getConnectionById } = useAppContext();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [testingId, setTestingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const resetForm = () => setForm(emptyForm);

  const handleSave = async () => {
    setError("");
    if (!form.name || !form.baseUrl) {
      setError("名称和地址不能为空");
      return;
    }
    let nextAuthType = form.authType;
    let nextBaseUrl = form.baseUrl;
    let nextUsername = form.username;
    let nextPassword = form.password;
    if (form.authType === "none") {
      try {
        const url = new URL(form.baseUrl);
        if (url.username || url.password) {
          nextAuthType = "basic";
          nextUsername = decodeURIComponent(url.username);
          nextPassword = decodeURIComponent(url.password);
          url.username = "";
          url.password = "";
          nextBaseUrl = url.toString().replace(/\/$/, "");
        }
      } catch {
        // ignore parse errors
      }
    }
    const id = form.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const profile: ConnectionProfile = {
      id,
      name: form.name,
      baseUrl: nextBaseUrl,
      authType: nextAuthType,
      verifyTls: form.verifyTls
    };

    await saveConnection(profile, {
      username: nextUsername,
      password: nextPassword,
      apiKey: form.apiKey
    });
    resetForm();
  };

  const handleEdit = (id: string) => {
    const profile = state.profiles.find((item) => item.id === id);
    if (!profile) return;
    const secret = state.secrets[id] ?? {};
    setForm({
      id,
      name: profile.name,
      baseUrl: profile.baseUrl,
      authType: profile.authType,
      verifyTls: profile.verifyTls,
      username: secret.username ?? "",
      password: secret.password ?? "",
      apiKey: secret.apiKey ?? ""
    });
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setError("");
    
    try {
      const connection = getConnectionById(id);
      if (!connection) {
        throw new Error("连接不存在");
      }
      await pingCluster(connection);
      setError(`连接成功：${connection.name}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "连接失败";
      setError(`连接失败：${message}`);
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="page">
      <div className="card">
        <div className="card-header">
           <h3 className="card-title">新建 / 编辑连接</h3>
        </div>
        <div className="card-body">
            <div className="form-grid">
              <div>
                <label>名称</label>
                <input className="form-control" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例如：生产环境 logs" />
              </div>
              <div>
                <label>Base URL</label>
                <input className="form-control" value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} placeholder="http://127.0.0.1:9200" />
              </div>
              <div>
                <label>认证方式</label>
                <select className="form-control" value={form.authType} onChange={(event) => setForm({ ...form, authType: event.target.value as AuthType })}>
                  <option value="none">无 (None)</option>
                  <option value="basic">用户名密码 (Basic)</option>
                  <option value="apiKey">API Key</option>
                </select>
              </div>
              <div>
                <label>校验 TLS 证书</label>
                <select className="form-control" value={String(form.verifyTls)} onChange={(event) => setForm({ ...form, verifyTls: event.target.value === "true" })}>
                  <option value="true">是 (Yes)</option>
                  <option value="false">否 (No) - 不安全</option>
                </select>
              </div>
              {form.authType === "basic" && (
                <>
                  <div>
                    <label>用户名</label>
                    <input className="form-control" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
                  </div>
                  <div>
                    <label>密码</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input 
                        className="form-control" 
                        type={showPassword ? "text" : "password"} 
                        value={form.password} 
                        onChange={(event) => setForm({ ...form, password: event.target.value })}
                        style={{ paddingRight: '36px' }}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '4px',
                          padding: '4px 8px',
                          fontSize: '16px',
                          cursor: 'pointer',
                          border: 'none',
                          background: 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title={showPassword ? "隐藏密码" : "显示密码"}
                      >
                        {showPassword ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                </>
              )}
              {form.authType === "apiKey" && (
                <div className="span-2">
                  <label>API Key</label>
                  <input className="form-control" value={form.apiKey} onChange={(event) => setForm({ ...form, apiKey: event.target.value })} />
                </div>
              )}
            </div>
            <div className="toolbar" style={{ marginTop: '20px' }}>
              <div className="button-group">
                <button className="btn btn-primary" onClick={handleSave}>保存连接</button>           
                <button className="btn btn-secondary" onClick={resetForm}>清空表单</button>
              </div>
              {error && <span className={error.includes("成功") ? "text-success" : "text-danger"} style={{ marginLeft: '12px' }}>{error}</span>}
              <div style={{ marginLeft: 'auto' }} className="muted">支持在 Base URL 中直接携带 user:pass</div>
            </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
           <h3 className="card-title">已保存连接</h3>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '25%' }}>名称</th>
                <th style={{ width: '35%' }}>地址</th>
                <th style={{ width: '15%' }}>认证</th>
                <th style={{ width: '25%', textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {state.profiles.map((profile) => (
                <tr key={profile.id}>
                  <td style={{ fontWeight: 500 }}>
                    {profile.name}
                    {profile.id === state.lastConnectionId && <span style={{ marginLeft: '8px', fontSize: '11px', background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '4px' }}>当前使用</span>}
                  </td>
                  <td className="muted">{profile.baseUrl}</td>
                  <td><span className="pill">{profile.authType}</span></td>
                  <td className="table-actions" style={{ textAlign: 'right' }}>
                    <div className="flex-gap justify-end" style={{ gap: '4px'}}>
                      <button className="btn btn-sm btn-secondary" title="设为当前" onClick={() => setActiveConnection(profile.id)}>使用</button>
                      <button className="btn btn-sm btn-ghost" title="测试连接" onClick={() => handleTest(profile.id)} disabled={testingId === profile.id}>
                        {testingId === profile.id ? "..." : "测试"}
                      </button>
                      <button className="btn btn-sm btn-ghost" title="编辑" onClick={() => handleEdit(profile.id)}>编辑</button>
                      <button className="btn btn-sm btn-ghost text-danger" title="删除" onClick={() => deleteConnection(profile.id)}>删除</button>
                    </div>
                  </td>
                </tr>
              ))}
              {state.profiles.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: '32px' }}>暂无已保存的连接</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>


    </div>
  );
}
