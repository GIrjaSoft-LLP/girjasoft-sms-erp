"use client";

import { useEffect, useMemo, useState } from "react";
import type { EmailClientPublic } from "@/lib/email/types";
import { PASSWORD_MASK } from "@/lib/email/types";
import { api } from "@/lib/client";

type Status = { label: string; tone: "muted" | "success" | "warning" };
type EmailConfigSource = "workspace" | "platform" | "none";

type EmailSettingsResponse = {
  emailClient: EmailClientPublic;
  status: Status;
  effectiveSource?: EmailConfigSource;
  effectiveStatus?: Status;
  effectiveEmailClient?: EmailClientPublic | null;
};

type Props = {
  scope?: "workspace" | "platform";
};

function EmailFields({
  config,
  smtpPassword,
  onConfigChange,
  onPasswordChange,
  readOnly = false,
}: {
  config: EmailClientPublic;
  smtpPassword: string;
  onConfigChange: (patch: Partial<EmailClientPublic>) => void;
  onPasswordChange: (value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <>
      <div>
        <h3 className="mb-2 text-sm font-semibold gs-heading">Account</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Username
            <input
              className="gs-input mt-1"
              value={config.smtpUsername}
              disabled={readOnly}
              onChange={(e) => onConfigChange({ smtpUsername: e.target.value })}
            />
          </label>
          <label className="text-sm">
            Password
            <input
              type="password"
              className="gs-input mt-1"
              value={smtpPassword}
              disabled={readOnly}
              placeholder={config.hasPassword ? PASSWORD_MASK : ""}
              onChange={(e) => onPasswordChange(e.target.value)}
            />
          </label>
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold gs-heading">Incoming Mail</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm md:col-span-2">
            Incoming Server
            <input
              className="gs-input mt-1"
              value={config.incomingServer}
              disabled={readOnly}
              onChange={(e) => onConfigChange({ incomingServer: e.target.value })}
            />
          </label>
          <label className="text-sm">
            IMAP Port
            <input
              type="number"
              className="gs-input mt-1"
              value={config.imapPort}
              disabled={readOnly}
              onChange={(e) => onConfigChange({ imapPort: Number(e.target.value) })}
            />
          </label>
          <label className="text-sm">
            POP3 Port
            <input
              type="number"
              className="gs-input mt-1"
              value={config.pop3Port}
              disabled={readOnly}
              onChange={(e) => onConfigChange({ pop3Port: Number(e.target.value) })}
            />
          </label>
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold gs-heading">Outgoing Mail</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm md:col-span-2">
            Outgoing Server
            <input
              className="gs-input mt-1"
              value={config.smtpHost}
              disabled={readOnly}
              onChange={(e) => onConfigChange({ smtpHost: e.target.value })}
            />
          </label>
          <label className="text-sm">
            SMTP Port
            <input
              type="number"
              className="gs-input mt-1"
              value={config.smtpPort}
              disabled={readOnly}
              onChange={(e) => onConfigChange({ smtpPort: Number(e.target.value) })}
            />
          </label>
          <label className="text-sm">
            Encryption
            <select
              className="gs-input mt-1"
              value={config.encryption}
              disabled={readOnly}
              onChange={(e) =>
                onConfigChange({ encryption: e.target.value as EmailClientPublic["encryption"] })
              }
            >
              <option value="none">None</option>
              <option value="ssl">SSL</option>
              <option value="tls">TLS</option>
              <option value="starttls">STARTTLS</option>
            </select>
          </label>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">
          From Email
          <input
            type="email"
            className="gs-input mt-1"
            value={config.fromEmail}
            disabled={readOnly}
            onChange={(e) => onConfigChange({ fromEmail: e.target.value })}
          />
        </label>
        <label className="text-sm">
          From Name
          <input
            className="gs-input mt-1"
            value={config.fromName}
            disabled={readOnly}
            onChange={(e) => onConfigChange({ fromName: e.target.value })}
          />
        </label>
        <label className="text-sm md:col-span-2">
          Reply-To Email
          <input
            type="email"
            className="gs-input mt-1"
            value={config.replyToEmail}
            disabled={readOnly}
            onChange={(e) => onConfigChange({ replyToEmail: e.target.value })}
          />
        </label>
      </div>
    </>
  );
}

export function EmailClientSection({ scope = "workspace" }: Props) {
  const isPlatform = scope === "platform";
  const apiBase = isPlatform ? "/api/platform/settings/email" : "/api/settings/email";
  const testApi = `${apiBase}/test`;

  const [visible, setVisible] = useState<boolean | null>(null);
  const [config, setConfig] = useState<EmailClientPublic | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [effectiveSource, setEffectiveSource] = useState<EmailConfigSource>("none");
  const [effectiveStatus, setEffectiveStatus] = useState<Status | null>(null);
  const [effectiveConfig, setEffectiveConfig] = useState<EmailClientPublic | null>(null);
  const [smtpPassword, setSmtpPassword] = useState("");
  const [testTo, setTestTo] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showTest, setShowTest] = useState(false);

  const title = isPlatform ? "Email Configuration" : "Email Client";
  const description = isPlatform
    ? "Configure platform-level SMTP for platform notifications and services."
    : "Configure SMTP for password reset and notifications. When disabled, the platform email configuration is used.";

  useEffect(() => {
    api<EmailSettingsResponse>(apiBase)
      .then((data) => {
        setVisible(true);
        setConfig(data.emailClient);
        setStatus(data.status);
        setEffectiveSource(data.effectiveSource ?? (isPlatform ? "platform" : "none"));
        setEffectiveStatus(data.effectiveStatus ?? data.status);
        setEffectiveConfig(data.effectiveEmailClient ?? null);
        setSmtpPassword(data.emailClient.hasPassword ? PASSWORD_MASK : "");
      })
      .catch(() => setVisible(false));
  }, [apiBase, isPlatform]);

  const displayStatus = useMemo(() => {
    if (isPlatform) return status;
    return effectiveStatus ?? status;
  }, [effectiveStatus, isPlatform, status]);

  const usingPlatformFallback = !isPlatform && effectiveSource === "platform";
  const showReadOnlyEffective = usingPlatformFallback && !config?.enabled && Boolean(effectiveConfig);
  const formConfig = showReadOnlyEffective && effectiveConfig ? effectiveConfig : config;

  if (visible === null || !visible) return null;
  if (!config || !formConfig) return <p className="text-sm gs-muted">Loading email configuration…</p>;

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload: Record<string, unknown> = { ...config };
      if (smtpPassword && smtpPassword !== PASSWORD_MASK) {
        payload.smtpPassword = smtpPassword;
      }
      delete payload.hasPassword;
      delete payload.passwordMasked;
      const data = await api<EmailSettingsResponse & { message: string }>(apiBase, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setConfig(data.emailClient);
      setStatus(data.status);
      setEffectiveSource(data.effectiveSource ?? "none");
      setEffectiveStatus(data.effectiveStatus ?? data.status);
      setEffectiveConfig(data.effectiveEmailClient ?? null);
      setSmtpPassword(data.emailClient.hasPassword ? PASSWORD_MASK : "");
      setMessage("✓ Email client configuration saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save configuration.");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setError("");
    setMessage("");
    try {
      const data = await api<{ message: string }>(testApi, {
        method: "POST",
        body: JSON.stringify({ to: testTo }),
      });
      setMessage(`✓ ${data.message}`);
      const refreshed = await api<EmailSettingsResponse>(apiBase);
      setConfig(refreshed.emailClient);
      setStatus(refreshed.status);
      setEffectiveSource(refreshed.effectiveSource ?? "none");
      setEffectiveStatus(refreshed.effectiveStatus ?? refreshed.status);
      setEffectiveConfig(refreshed.effectiveEmailClient ?? null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to send test email. Please verify SMTP configuration.",
      );
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="gs-card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold gs-heading">{title}</h2>
          <p className="text-sm gs-muted">{description}</p>
        </div>
        {displayStatus ? (
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              displayStatus.tone === "success"
                ? "bg-emerald-100 text-emerald-800"
                : displayStatus.tone === "warning"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {displayStatus.tone === "success" ? "✓ " : displayStatus.tone === "warning" ? "⚠ " : ""}
            {displayStatus.label}
          </span>
        ) : null}
      </div>

      {usingPlatformFallback ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          This workspace is currently using the <strong>Platform Administration</strong> email configuration.
          Enable and save a custom workspace configuration below to override it.
        </div>
      ) : null}

      <div className="space-y-4">
        {!isPlatform ? (
          <label className="flex items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig((c) => (c ? { ...c, enabled: e.target.checked } : c))}
            />
            Use custom workspace email configuration
          </label>
        ) : (
          <label className="flex items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig((c) => (c ? { ...c, enabled: e.target.checked } : c))}
            />
            Enable Email Client
          </label>
        )}

        <EmailFields
          config={formConfig}
          smtpPassword={showReadOnlyEffective ? PASSWORD_MASK : smtpPassword}
          readOnly={showReadOnlyEffective}
          onConfigChange={(patch) => {
            if (showReadOnlyEffective) return;
            setConfig((c) => (c ? { ...c, ...patch } : c));
          }}
          onPasswordChange={(value) => {
            if (showReadOnlyEffective) return;
            setSmtpPassword(value);
          }}
        />

        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-lg border px-4 py-2 text-sm gs-tab" onClick={() => setShowTest((v) => !v)}>
            Test Email Configuration
          </button>
          {!showReadOnlyEffective ? (
            <button type="button" className="gs-btn px-4 py-2 text-sm" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save Configuration"}
            </button>
          ) : null}
        </div>

        {showTest ? (
          <div className="space-y-3 rounded-lg border gs-border p-4">
            <label className="block text-sm">
              Send Test Email To
              <input
                type="email"
                className="gs-input mt-1"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="gs-btn px-4 py-2 text-sm"
              disabled={testing || !testTo || effectiveSource === "none"}
              onClick={() => void sendTest()}
            >
              {testing ? "Sending…" : "Send Test Email"}
            </button>
          </div>
        ) : null}
      </div>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">✕ {error}</p> : null}
    </div>
  );
}
