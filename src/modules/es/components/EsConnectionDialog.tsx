import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { logError } from "../../../lib/errorLog";
import type { ConnectionProfile } from "../../../lib/types";
import { useSharedConnectionState } from "../../../state/SharedConnectionState";
import { pingEsCluster } from "../services/clusterService";
import type { EsConnection } from "../types";
import { ES_VERSION_OPTIONS } from "../types";

const emptyForm = {
  id: "",
  name: "",
  baseUrl: "http://localhost:9200",
  authType: "none" as "none" | "basic" | "apiKey",
  username: "",
  password: "",
  apiKey: "",
  verifyTls: true,
  sshEnabled: false,
  sshHost: "",
  sshPort: 22,
  sshUsername: "",
  sshPassword: "",
  sshAuthMethod: "password" as "password" | "key" | "agent",
  sshPrivateKeyPath: "",
  sshPassphrase: "",
  sshHostKeyMode: "accept-new" as "strict" | "accept-new" | "insecure",
  tlsMode: "",
  tlsCaCertPath: "",
  tlsClientCertPath: "",
  tlsClientKeyPath: "",
  connectionType: "" as "" | "development" | "test" | "production",
  esVersion: "7",
};

interface EsConnectionDialogProps {
  mode: "add" | "edit" | "copy";
  profileId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EsConnectionDialog({
  mode,
  profileId,
  onClose,
  onSuccess,
}: EsConnectionDialogProps) {
  const { t } = useTranslation();
  const { profiles, getSecretById, saveConnection } = useSharedConnectionState();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [testingId, setTestingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showSshPassword, setShowSshPassword] = useState(false);
  const [showSshPassphrase, setShowSshPassphrase] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEditing = mode === "edit" || mode === "copy";

  useEffect(() => {
    setError("");
    setShowPassword(false);
    setShowSshPassword(false);
    setShowSshPassphrase(false);

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
        baseUrl: profile.baseUrl ?? "http://localhost:9200",
        authType: profile.authType ?? "none",
        username: secret.username ?? "",
        password: secret.password ?? "",
        apiKey: secret.apiKey ?? "",
        verifyTls: profile.verifyTls ?? true,
        sshEnabled: profile.ssh?.enabled ?? false,
        sshHost: profile.ssh?.host ?? "",
        sshPort: profile.ssh?.port ?? 22,
        sshUsername: profile.ssh?.username ?? "",
        sshPassword: secret.sshPassword ?? "",
        sshAuthMethod: profile.ssh?.authMethod ?? "password",
        sshPrivateKeyPath: profile.ssh?.privateKeyPath ?? "",
        sshPassphrase: secret.sshPassphrase ?? "",
        sshHostKeyMode: profile.ssh?.hostKeyMode ?? "accept-new",
        tlsMode: profile.tlsMode ?? "",
        tlsCaCertPath: profile.tlsCaCertPath ?? "",
        tlsClientCertPath: profile.tlsClientCertPath ?? "",
        tlsClientKeyPath: profile.tlsClientKeyPath ?? "",
        connectionType: profile.connectionType ?? "",
        esVersion: profile.esVersion ?? "7",
      });
    }
  }, [mode, profileId, profiles, getSecretById, t, onClose]);

  const handleSave = async () => {
    setError("");
    setSaving(true);
    if (!form.name || !form.baseUrl) {
      setMessageType("error");
      setError(t("connections.nameAndAddressRequired"));
      setSaving(false);
      return;
    }

    const id = form.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const sshConfig = form.sshEnabled ? {
      enabled: true,
      host: form.sshHost,
      port: form.sshPort,
      username: form.sshUsername,
      authMethod: form.sshAuthMethod,
      privateKeyPath: form.sshAuthMethod === "key" ? form.sshPrivateKeyPath : undefined,
      passphrase: form.sshPassphrase || undefined,
      hostKeyMode: form.sshHostKeyMode,
    } : undefined;

    const profile: ConnectionProfile = {
      id,
      name: form.name,
      engine: "elasticsearch",
      baseUrl: form.baseUrl,
      authType: form.authType,
      verifyTls: form.verifyTls,
      ssh: sshConfig,
      tlsMode: form.tlsMode || undefined,
      tlsCaCertPath: form.tlsCaCertPath || undefined,
      tlsClientCertPath: form.tlsClientCertPath || undefined,
      tlsClientKeyPath: form.tlsClientKeyPath || undefined,
      connectionType: form.connectionType || undefined,
      esVersion: form.esVersion || "7",
    };

    try {
      await saveConnection(profile, {
        username: form.authType === "basic" ? form.username : undefined,
        password: form.authType === "basic" ? form.password : undefined,
        apiKey: form.authType === "apiKey" ? form.apiKey : undefined,
        sshPassword: form.sshEnabled && form.sshAuthMethod === "password" ? form.sshPassword : undefined,
        sshPassphrase: form.sshEnabled && form.sshPassphrase ? form.sshPassphrase : undefined,
        sshPrivateKeyPem: form.sshEnabled && form.sshAuthMethod === "key" ? "" : undefined,
        tlsCaCertPem: form.tlsMode === "custom" ? "" : undefined,
      });
      onSuccess();
    } catch (err) {
      logError(err, { source: "esConnectionDialog.save", message: "Failed to save ES connection" });
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
      const profile = profiles.find((item) => item.id === targetId);
      if (!profile) {
        throw new Error(t("connections.connectionNotFound"));
      }

      const secret = getSecretById(targetId);
      const connection: EsConnection = {
        id: profile.id,
        name: profile.name,
        engine: "elasticsearch",
        baseUrl: profile.baseUrl ?? "http://localhost:9200",
        authType: profile.authType ?? "none",
        verifyTls: profile.verifyTls ?? true,
        username: secret.username,
        password: secret.password,
        apiKey: secret.apiKey,
        ssh: profile.ssh,
        sshPassword: secret.sshPassword,
        tlsMode: profile.tlsMode,
        tlsCaCertPath: profile.tlsCaCertPath,
        tlsClientCertPath: profile.tlsClientCertPath,
        tlsClientKeyPath: profile.tlsClientKeyPath,
      };

      await pingEsCluster(connection);
      setMessageType("success");
      setError(t("connections.connectionSuccess", { name: profile.name }));
    } catch (err) {
      logError(err, {
        source: "esConnectionDialog.testConnection",
        message: `Failed to test ES connection ${targetId}`
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
            <input className="form-control" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. local es" />
          </div>
          <div>
            <label>{t("connections.engine")}</label>
            <input className="form-control" value="Elasticsearch" disabled />
          </div>
          <div className="form-grid-span-2">
            <label>{t("connections.baseUrl")}</label>
            <input className="form-control" value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} placeholder="http://localhost:9200" />
          </div>
          <div>
            <label>{t("connections.authType")}</label>
            <select className="form-control" value={form.authType} onChange={(event) => setForm({ ...form, authType: event.target.value as "none" | "basic" | "apiKey" })}>
              <option value="none">{t("connections.authNone")}</option>
              <option value="basic">{t("connections.authBasic")}</option>
              <option value="apiKey">{t("connections.authApiKey")}</option>
            </select>
          </div>
          {form.authType === "basic" && (
            <>
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
            </>
          )}
          {form.authType === "apiKey" && (
            <div className="form-grid-span-2">
              <label>{t("connections.apiKey")}</label>
              <input className="form-control" value={form.apiKey} onChange={(event) => setForm({ ...form, apiKey: event.target.value })} placeholder="Enter API key" />
            </div>
          )}
          <div>
            <label className="verify-tls-toggle-label">
              <input
                type="checkbox"
                checked={form.verifyTls}
                onChange={(event) => setForm({ ...form, verifyTls: event.target.checked })}
              />
              {t("connections.verifyTls")}
            </label>
          </div>

          {/* Environment type */}
          <div>
            <label>{t("connections.connectionType", "Environment")}</label>
            <select
              className="form-control"
              value={form.connectionType}
              onChange={(event) => setForm({ ...form, connectionType: event.target.value as "development" | "test" | "production" | "" })}
            >
              <option value="">{t("connections.envUnspecified")}</option>
              <option value="development">{t("connections.envDevelopment")}</option>
              <option value="test">{t("connections.envTest")}</option>
              <option value="production">{t("connections.envProduction")}</option>
            </select>
          </div>

          {/* ES version */}
          <div>
            <label>{t("connection.esVersion", "ES Version")}</label>
            <select
              className="form-control"
              value={form.esVersion}
              onChange={(event) => setForm({ ...form, esVersion: event.target.value })}
            >
              {ES_VERSION_OPTIONS.map((v) => (
                <option key={v} value={v}>{t(`connection.esVersion${v}`)}</option>
              ))}
            </select>
          </div>

          {/* SSH section */}
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
              <div>
                <label>{t("connections.sshAuthMethod")}</label>
                <select
                  className="form-control"
                  value={form.sshAuthMethod}
                  onChange={(event) => setForm({ ...form, sshAuthMethod: event.target.value as "password" | "key" | "agent" })}
                >
                  <option value="password">{t("connections.sshAuthPassword")}</option>
                  <option value="key">{t("connections.sshAuthKey")}</option>
                  <option value="agent">{t("connections.sshAuthAgent")}</option>
                </select>
              </div>

              {form.sshAuthMethod === "password" && (
                <>
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

              {form.sshAuthMethod === "key" && (
                <>
                  <div>
                    <label>{t("connections.sshPrivateKeyPath")}</label>
                    <input className="form-control" value={form.sshPrivateKeyPath} onChange={(event) => setForm({ ...form, sshPrivateKeyPath: event.target.value })} placeholder="~/.ssh/id_rsa" />
                  </div>
                  <div>
                    <label>{t("connections.sshPassphrase")}</label>
                    <div className="password-field-wrap">
                      <input
                        className="form-control password-field-input"
                        type={showSshPassphrase ? "text" : "password"}
                        value={form.sshPassphrase}
                        onChange={(event) => setForm({ ...form, sshPassphrase: event.target.value })}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon password-toggle-button"
                        onClick={() => setShowSshPassphrase(!showSshPassphrase)}
                        title={showSshPassphrase ? t("connections.hidePassword") : t("connections.showPassword")}
                      >
                        {showSshPassphrase ? "🙈" : "👁️"}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {form.sshAuthMethod === "agent" && (
                <div>
                  <label style={{ color: "var(--text-secondary, #888)", fontSize: "13px" }}>
                    {t("connections.sshAgentHint", "Uses system SSH agent (Pageant on Windows, ssh-agent on Unix)")}
                  </label>
                </div>
              )}

              <div>
                <label>{t("connections.sshHostKeyVerification")}</label>
                <select
                  className="form-control"
                  value={form.sshHostKeyMode}
                  onChange={(event) => setForm({ ...form, sshHostKeyMode: event.target.value as "strict" | "accept-new" | "insecure" })}
                >
                  <option value="strict">{t("connections.hostKeyStrict")}</option>
                  <option value="accept-new">{t("connections.hostKeyAcceptNew")}</option>
                  <option value="insecure">{t("connections.hostKeyInsecure")}</option>
                </select>
              </div>
            </>
          )}

          {/* TLS section */}
          <div className="ssh-section-divider" />
          <div>
            <label>{t("connections.mysqlTlsMode", "SSL/TLS Mode")}</label>
            <select
              className="form-control"
              value={form.tlsMode}
              onChange={(event) => setForm({ ...form, tlsMode: event.target.value })}
            >
              <option value="">{t("connections.tlsDisabled")}</option>
              <option value="required">{t("connections.tlsRequired")}</option>
              <option value="verify_ca">{t("connections.tlsVerifyCa")}</option>
              <option value="verify_identity">{t("connections.tlsVerifyIdentity")}</option>
              <option value="custom">{t("connections.tlsCustom")}</option>
            </select>
          </div>
          {form.tlsMode === "custom" && (
            <>
              <div>
                <label>{t("connections.mysqlTlsCaCert")}</label>
                <input className="form-control" value={form.tlsCaCertPath} onChange={(event) => setForm({ ...form, tlsCaCertPath: event.target.value })} placeholder="Path to CA certificate" />
              </div>
              <div>
                <label>{t("connections.mysqlTlsClientCert")}</label>
                <input className="form-control" value={form.tlsClientCertPath} onChange={(event) => setForm({ ...form, tlsClientCertPath: event.target.value })} placeholder="Path to client certificate" />
              </div>
              <div>
                <label>{t("connections.mysqlTlsClientKey")}</label>
                <input className="form-control" value={form.tlsClientKeyPath} onChange={(event) => setForm({ ...form, tlsClientKeyPath: event.target.value })} placeholder="Path to client key" />
              </div>
            </>
          )}
          {(form.tlsMode === "required" || form.tlsMode === "verify_ca" || form.tlsMode === "verify_identity") && (
            <div style={{ gridColumn: "1 / -1" }}>
              <span style={{ color: "var(--text-secondary, #888)", fontSize: "12px" }}>
                {form.tlsMode === "required" && t("connections.tlsHintRequired")}
                {form.tlsMode === "verify_ca" && t("connections.tlsHintVerifyCa")}
                {form.tlsMode === "verify_identity" && t("connections.tlsHintVerifyIdentity")}
              </span>
            </div>
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
