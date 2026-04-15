import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { logError } from "../../../lib/errorLog";
import type { ConnectionProfile } from "../../../lib/types";
import { useSharedConnectionState } from "../../../state/SharedConnectionState";
import { mysqlConnect, mysqlDisconnect } from "../services/connectionClient";
import type { MysqlConnection } from "../types";

const emptyForm = {
  id: "",
  name: "",
  host: "127.0.0.1",
  port: 3306,
  database: "",
  username: "root",
  password: "",
  sshEnabled: false,
  sshHost: "",
  sshPort: 22,
  sshUsername: "",
  sshPassword: "",
};

interface MysqlConnectionDialogProps {
  mode: "add" | "edit" | "copy";
  profileId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function MysqlConnectionDialog({
  mode,
  profileId,
  onClose,
  onSuccess,
}: MysqlConnectionDialogProps) {
  const { t } = useTranslation();
  const { profiles, getSecretById, saveConnection } = useSharedConnectionState();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [testingId, setTestingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showSshPassword, setShowSshPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEditing = mode === "edit" || mode === "copy";

  useEffect(() => {
    setError("");
    setShowPassword(false);
    setShowSshPassword(false);

    if (mode === "add") {
      setForm(emptyForm);
      return;
    }

    if (isEditing && profileId) {
      const profile = profiles.find((item) => item.id === profileId);
      if (!profile) {
        onClose();
        return;
      }
      const secret = getSecretById(profileId);
      const nextName = mode === "copy" ? `${profile.name} - ${t("common.copy")}` : profile.name;
      setForm({
        id: mode === "copy" ? "" : profileId,
        name: nextName,
        host: profile.mysqlHost ?? "127.0.0.1",
        port: profile.mysqlPort ?? 3306,
        database: profile.mysqlDatabase ?? "",
        username: secret.username ?? "",
        password: secret.password ?? "",
        sshEnabled: profile.ssh?.enabled ?? false,
        sshHost: profile.ssh?.host ?? "",
        sshPort: profile.ssh?.port ?? 22,
        sshUsername: profile.ssh?.username ?? "",
        sshPassword: secret.sshPassword ?? "",
      });
    }
  }, [mode, profileId, profiles, getSecretById, t, onClose]);

  const handleSave = async () => {
    setError("");
    setSaving(true);
    if (!form.name || !form.host) {
      setMessageType("error");
      setError(t("connections.nameAndAddressRequired"));
      setSaving(false);
      return;
    }

    const id = form.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const profile: ConnectionProfile = {
      id,
      name: form.name,
      engine: "mysql",
      baseUrl: "",
      mysqlHost: form.host,
      mysqlPort: form.port,
      mysqlDatabase: form.database || undefined,
      authType: "basic",
      verifyTls: false,
      ssh: form.sshEnabled ? {
        enabled: true,
        host: form.sshHost,
        port: form.sshPort,
        username: form.sshUsername,
      } : undefined,
    };

    try {
      await saveConnection(profile, {
        username: form.username,
        password: form.password,
        sshPassword: form.sshEnabled ? form.sshPassword : undefined,
      });
      onSuccess();
    } catch (err) {
      logError(err, { source: "mysqlConnectionDialog.save", message: "Failed to save MySQL connection" });
      setMessageType("error");
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    const targetId = profileId ?? form.id;
    if (!targetId) return;

    setTestingId(targetId);
    setError("");

    try {
      const profile = profiles.find((p) => p.id === targetId);
      if (!profile) {
        throw new Error(t("connections.connectionNotFound"));
      }
      const secret = getSecretById(targetId);
      const conn: MysqlConnection = {
        id: profile.id,
        name: profile.name,
        engine: profile.engine,
        host: profile.mysqlHost ?? "127.0.0.1",
        port: profile.mysqlPort ?? 3306,
        database: profile.mysqlDatabase,
        username: secret.username,
        password: secret.password,
        ssh: profile.ssh,
        sshPassword: secret.sshPassword,
      };
      await mysqlConnect(conn);
      await mysqlDisconnect(targetId);
      setMessageType("success");
      setError(t("connections.connectionSuccess", { name: profile.name }));
    } catch (err) {
      logError(err, {
        source: "mysqlConnectionDialog.testConnection",
        message: `Failed to test MySQL connection ${targetId}`
      });
      setMessageType("error");
      setError(t("connections.connectionFailed", { error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="card modal-card modal-card-md modal-card-scroll" onClick={(event) => event.stopPropagation()}>
        <div className="card-header page-section-header">
          <h3 className="card-title">
            {mode === "edit" ? t("common.edit") : mode === "copy" ? t("common.copy") : t("connections.createConnection")}
          </h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>{t("common.close")}</button>
        </div>
        <div className="modal-card-body modal-card-grid">
          <div>
            <label>{t("connections.name")}</label>
            <input className="form-control" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Production MySQL" />
          </div>
          <div>
            <label>{t("connections.engine")}</label>
            <input className="form-control" value="MySQL" disabled />
          </div>
          <div>
            <label>{t("connections.mysqlHost")}</label>
            <input className="form-control" value={form.host} onChange={(event) => setForm({ ...form, host: event.target.value })} placeholder="127.0.0.1" />
          </div>
          <div>
            <label>{t("connections.mysqlPort")}</label>
            <input className="form-control" type="number" value={form.port} onChange={(event) => setForm({ ...form, port: Number(event.target.value) || 3306 })} placeholder="3306" />
          </div>
          <div>
            <label>{t("connections.mysqlDatabase")}</label>
            <input className="form-control" value={form.database} onChange={(event) => setForm({ ...form, database: event.target.value })} placeholder="(optional)" />
          </div>
          <div />
          <div>
            <label>{t("connections.username")}</label>
            <input className="form-control" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="root" />
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
          <div className="ssh-section-divider" />
          <div>
            <label className="ssh-toggle-label">
              <input
                type="checkbox"
                checked={form.sshEnabled}
                onChange={(event) => setForm({ ...form, sshEnabled: event.target.checked })}
              />
              {t("connections.useSshTunnel")}
            </label>
          </div>
          {form.sshEnabled && (
            <>
              <div>
                <label>{t("connections.sshHost")}</label>
                <input className="form-control" value={form.sshHost} onChange={(event) => setForm({ ...form, sshHost: event.target.value })} placeholder="127.0.0.1" />
              </div>
              <div>
                <label>{t("connections.sshPort")}</label>
                <input className="form-control" type="number" value={form.sshPort} onChange={(event) => setForm({ ...form, sshPort: Number(event.target.value) || 22 })} placeholder="22" />
              </div>
              <div>
                <label>{t("connections.sshUsername")}</label>
                <input className="form-control" value={form.sshUsername} onChange={(event) => setForm({ ...form, sshUsername: event.target.value })} placeholder="root" />
              </div>
              <div />
              <div>
                <label>{t("connections.sshPassword")}</label>
                <div className="password-field-wrap">
                  <input
                    className="form-control password-field-input"
                    type={showSshPassword ? "text" : "password"}
                    value={form.sshPassword}
                    onChange={(event) => setForm({ ...form, sshPassword: event.target.value })}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon password-toggle-button"
                    onClick={() => setShowSshPassword(!showSshPassword)}
                    title={showSshPassword ? t("connections.hidePassword") : t("connections.showPassword")}
                  >
                    {showSshPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>
            </>
          )}
          {error && <div className={`${messageType === "success" ? "text-success" : "text-danger"} inline-feedback`}>{error}</div>}
        </div>
        <div className="modal-card-footer" style={{ justifyContent: "space-between" }}>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <div style={{ display: "flex", gap: "8px" }}>
            {isEditing && (
              <button
                className="btn btn-sm btn-ghost"
                onClick={handleTest}
                disabled={testingId === (profileId ?? form.id)}
              >
                {testingId ? "..." : t("connections.test")}
              </button>
            )}
            <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={saving}>
              {t("connections.saveConnection")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
