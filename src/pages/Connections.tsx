import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const { state, saveConnection, deleteConnection, setActiveConnection, getConnectionById } = useAppContext();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [testingId, setTestingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const resetForm = () => setForm(emptyForm);

  const handleSave = async () => {
    setError("");
    if (!form.name || !form.baseUrl) {
      setError(t('connections.nameAndAddressRequired'));
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
        throw new Error(t('connections.connectionNotFound'));
      }
      await pingCluster(connection);
      setError(t('connections.connectionSuccess', { name: connection.name }));
    } catch (err) {
      const message = err instanceof Error ? err.message : t('connections.connectionFailed', { error: '' });
      setError(t('connections.connectionFailed', { error: message }));
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="page">
      <div className="card">
        <div className="card-header">
           <h3 className="card-title">{t('connections.editConnection')}</h3>
        </div>
        <div className="card-body">
            <div className="form-grid">
              <div>
                <label>{t('connections.name')}</label>
                <input className="form-control" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例如：生产环境 logs" />
              </div>
              <div>
                <label>{t('connections.baseUrl')}</label>
                <input className="form-control" value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} placeholder="http://127.0.0.1:9200" />
              </div>
              <div>
                <label>{t('connections.authMethod')}</label>
                <select className="form-control" value={form.authType} onChange={(event) => setForm({ ...form, authType: event.target.value as AuthType })}>
                  <option value="none">{t('connections.authNone')}</option>
                  <option value="basic">{t('connections.authBasic')}</option>
                  <option value="apiKey">{t('connections.apiKey')}</option>
                </select>
              </div>
              <div>
                <label>{t('connections.verifyCertificate')}</label>
                <select className="form-control" value={String(form.verifyTls)} onChange={(event) => setForm({ ...form, verifyTls: event.target.value === "true" })}>
                  <option value="true">{t('connections.verifyYes')}</option>
                  <option value="false">{t('connections.verifyNo')}</option>
                </select>
              </div>
              {form.authType === "basic" && (
                <>
                  <div>
                    <label>{t('connections.username')}</label>
                    <input className="form-control" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
                  </div>
                  <div>
                    <label>{t('connections.password')}</label>
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
                        title={showPassword ? t('connections.hidePassword') : t('connections.showPassword')}
                      >
                        {showPassword ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                </>
              )}
              {form.authType === "apiKey" && (
                <div className="span-2">
                  <label>{t('connections.apiKey')}</label>
                  <input className="form-control" value={form.apiKey} onChange={(event) => setForm({ ...form, apiKey: event.target.value })} />
                </div>
              )}
            </div>
            <div className="toolbar" style={{ marginTop: '20px' }}>
              <div className="button-group">
                <button className="btn btn-primary" onClick={handleSave}>{t('connections.saveConnection')}</button>
                <button className="btn btn-secondary" onClick={resetForm}>{t('connections.clearForm')}</button>
              </div>
              {error && <span className={error.includes("成功") ? "text-success" : "text-danger"} style={{ marginLeft: '12px' }}>{error}</span>}
              <div style={{ marginLeft: 'auto' }} className="muted">{t('connections.supportNote')}</div>
            </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
           <h3 className="card-title">{t('connections.savedConnections')}</h3>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '25%' }}>{t('connections.connectionName')}</th>
                <th style={{ width: '35%' }}>{t('connections.address')}</th>
                <th style={{ width: '15%' }}>{t('connections.authentication')}</th>
                <th style={{ width: '25%', textAlign: 'right' }}>{t('connections.operations')}</th>
              </tr>
            </thead>
            <tbody>
              {state.profiles.map((profile) => (
                <tr key={profile.id}>
                  <td style={{ fontWeight: 500 }}>
                    {profile.name}
                    {profile.id === state.lastConnectionId && <span style={{ marginLeft: '8px', fontSize: '11px', background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '4px' }}>{t('connections.currentInUse')}</span>}
                  </td>
                  <td className="muted">{profile.baseUrl}</td>
                  <td><span className="pill">{profile.authType}</span></td>
                  <td className="table-actions" style={{ textAlign: 'right' }}>
                    <div className="flex-gap justify-end" style={{ gap: '4px'}}>
                      <button className="btn btn-sm btn-secondary" title={t('connections.setCurrent')} onClick={() => setActiveConnection(profile.id)}>{t('connections.use')}</button>
                      <button className="btn btn-sm btn-ghost" title={t('connections.testConnection')} onClick={() => handleTest(profile.id)} disabled={testingId === profile.id}>
                        {testingId === profile.id ? "..." : t('connections.test')}
                      </button>
                      <button className="btn btn-sm btn-ghost" title={t('common.edit')} onClick={() => handleEdit(profile.id)}>{t('common.edit')}</button>
                      <button className="btn btn-sm btn-ghost text-danger" title={t('common.delete')} onClick={() => deleteConnection(profile.id)}>{t('common.delete')}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {state.profiles.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: '32px' }}>{t('connections.noConnections')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>


    </div>
  );
}
