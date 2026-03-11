import { Modal } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { logError } from "../../../lib/errorLog";
import type { ConnectionProfile } from "../../../lib/types";
import { useAppContext } from "../../../state/AppContext";
import { redisConnect, redisDisconnect } from "../services/client";
import type { RedisConnection } from "../types";

const emptyForm = {
  id: "",
  name: "",
  host: "127.0.0.1",
  port: 6379,
  database: 0,
  username: "",
  password: "",
};

export default function RedisConnectionsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { state, activeConnectionId, saveConnection, deleteConnection } = useAppContext();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [testingId, setTestingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const action = searchParams.get("action");
  const selectedId = searchParams.get("id") ?? "";
  const isConfigVisible = action === "add" || action === "edit" || action === "copy";

  const redisProfiles = state.profiles.filter((item) => item.engine === "redis");

  const resetForm = () => {
    setForm(emptyForm);
    setError("");
  };

  const closeConfig = () => {
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from && from !== "/redis/connections" ? from : "/redis/browser", { replace: true });
  };

  const handleAdd = () => {
    setSearchParams({ action: "add" });
  };

  const handleSave = async () => {
    setError("");
    if (!form.name || !form.host) {
      setMessageType("error");
      setError(t("connections.nameAndAddressRequired"));
      return;
    }

    const id = form.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const profile: ConnectionProfile = {
      id,
      name: form.name,
      engine: "redis",
      baseUrl: "",
      redisHost: form.host,
      redisPort: form.port,
      redisDatabase: form.database,
      authType: "basic",
      verifyTls: false,
    };

    await saveConnection(profile, {
      username: form.username || undefined,
      password: form.password || undefined,
    });

    resetForm();
    closeConfig();
  };

  const handleEdit = (id: string) => {
    setSearchParams({ action: "edit", id });
  };

  const handleCopy = (id: string) => {
    setSearchParams({ action: "copy", id });
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setError("");

    try {
      const profile = state.profiles.find((item) => item.id === id);
      if (!profile) {
        throw new Error(t("connections.connectionNotFound"));
      }

      const secret = state.secrets[id] ?? {};
      const connection: RedisConnection = {
        id: profile.id,
        name: profile.name,
        engine: "redis",
        host: profile.redisHost ?? "127.0.0.1",
        port: profile.redisPort ?? 6379,
        database: profile.redisDatabase ?? 0,
        username: secret.username,
        password: secret.password,
      };

      await redisConnect(connection);
      await redisDisconnect(id);
      setMessageType("success");
      setError(t("connections.connectionSuccess", { name: profile.name }));
    } catch (err) {
      logError(err, {
        source: "redisConnections.testConnection",
        message: `Failed to test Redis connection ${id}`
      });
      setMessageType("error");
      setError(t("connections.connectionFailed", { error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setTestingId(null);
    }
  };

  useEffect(() => {
    if (!isConfigVisible) {
      return;
    }

    setError("");
    setShowPassword(false);

    if (action === "add") {
      setForm(emptyForm);
      return;
    }

    if ((action === "edit" || action === "copy") && selectedId) {
      const profile = state.profiles.find((item) => item.id === selectedId);
      if (!profile) {
        closeConfig();
        return;
      }

      const secret = state.secrets[selectedId] ?? {};
      const nextName = action === "copy" ? `${profile.name} - ${t("common.copy")}` : profile.name;
      setForm({
        id: action === "copy" ? "" : selectedId,
        name: nextName,
        host: profile.redisHost ?? "127.0.0.1",
        port: profile.redisPort ?? 6379,
        database: profile.redisDatabase ?? 0,
        username: secret.username ?? "",
        password: secret.password ?? "",
      });
      return;
    }

    closeConfig();
  }, [isConfigVisible, action, selectedId, state.profiles, state.secrets]);

  return (
    <div className="page">
      <div className="card">
        <div className="card-header page-section-header">
          <h3 className="card-title">{t("connections.savedConnections")}</h3>
          <button className="btn btn-primary" onClick={handleAdd}>
            + {t("connections.createConnection")}
          </button>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th className="col-w-25">{t("connections.connectionName")}</th>
                <th className="col-w-15">{t("connections.engine")}</th>
                <th className="col-w-25">{t("connections.address")}</th>
                <th className="col-w-10">{t("connections.redisDatabase")}</th>
                <th className="table-col-actions-header">{t("connections.operations")}</th>
              </tr>
            </thead>
            <tbody>
              {redisProfiles.map((profile) => (
                <tr key={profile.id}>
                  <td className="table-cell-strong">
                    {profile.name}
                    {profile.id === activeConnectionId && <span className="status-badge-current">{t("connections.currentInUse")}</span>}
                  </td>
                  <td><span className="pill">Redis</span></td>
                  <td className="muted">{profile.redisHost ?? "127.0.0.1"}:{profile.redisPort ?? 6379}</td>
                  <td className="muted">DB {profile.redisDatabase ?? 0}</td>
                  <td className="table-actions table-col-actions">
                    <div className="flex-gap justify-end table-action-group-tight">
                      <button className="btn btn-sm btn-ghost" title={t("connections.testConnection")} onClick={() => handleTest(profile.id)} disabled={testingId === profile.id}>
                        {testingId === profile.id ? "..." : t("connections.test")}
                      </button>
                      <button className="btn btn-sm btn-ghost" title={t("common.edit")} onClick={() => handleEdit(profile.id)}>{t("common.edit")}</button>
                      <button className="btn btn-sm btn-ghost" title={t("common.copy")} onClick={() => handleCopy(profile.id)}>{t("common.copy")}</button>
                      <button className="btn btn-sm btn-ghost text-danger" title={t("common.delete")} onClick={() => deleteConnection(profile.id)}>{t("common.delete")}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {redisProfiles.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted table-empty-cell">{t("connections.noConnections")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {error && <div className={`${messageType === "success" ? "text-success" : "text-danger"} inline-feedback-padded`}>{error}</div>}

      <Modal
        title={action === "edit" ? t("common.edit") : action === "copy" ? t("common.copy") : t("connections.createConnection")}
        open={isConfigVisible}
        onOk={handleSave}
        onCancel={closeConfig}
        width={600}
        okText={t("connections.saveConnection")}
        cancelText={t("common.cancel")}
      >
        <div className="form-grid form-grid-spaced">
          <div>
            <label>{t("connections.name")}</label>
            <input className="form-control" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. local redis" />
          </div>
          <div>
            <label>{t("connections.engine")}</label>
            <input className="form-control" value="Redis" disabled />
          </div>
          <div>
            <label>{t("connections.redisHost")}</label>
            <input className="form-control" value={form.host} onChange={(event) => setForm({ ...form, host: event.target.value })} placeholder="127.0.0.1" />
          </div>
          <div>
            <label>{t("connections.redisPort")}</label>
            <input className="form-control" type="number" value={form.port} onChange={(event) => setForm({ ...form, port: Number(event.target.value) || 6379 })} />
          </div>
          <div>
            <label>{t("connections.redisDatabase")}</label>
            <input className="form-control" type="number" min={0} value={form.database} onChange={(event) => setForm({ ...form, database: Math.max(0, Number(event.target.value) || 0) })} />
          </div>
          <div />
          <div>
            <label>{t("connections.username")}</label>
            <input className="form-control" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="(optional)" />
          </div>
          <div>
            <label>{t("connections.password")}</label>
            <div className="password-field-wrap">
              <input
                className="form-control password-field-input"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
              <button
                type="button"
                className="btn btn-ghost btn-icon password-toggle-button"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? t("connections.hidePassword") : t("connections.showPassword")}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
        </div>
        {error && <div className={`${messageType === "success" ? "text-success" : "text-danger"} inline-feedback`}>{error}</div>}
      </Modal>
    </div>
  );
}