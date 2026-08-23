"use client";

import { useEffect, useMemo, useState } from "react";
import type { EmailClientPublic } from "@/lib/email/types";
import { PASSWORD_MASK } from "@/lib/email/types";
import { api } from "@/lib/client";

type Status = { label: string; tone: "muted" | "success" | "warning" };

type Props = {
  scope?: "workspace" | "platform";
};

export function EmailClientSection({ scope = "workspace" }: Props) {
  const isPlatform = scope === "platform";
  const apiBase = isPlatform ? "/api/platform/settings/email" : "/api/settings/email";
  const testApi = `${apiBase}/test`;

  const [visible, setVisible] = useState<boolean | null>(null);
  const [config, setConfig] = useState<EmailClientPublic | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
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
    : "Configure SMTP for password reset and future notifications.";

  useEffect(() => {
    api<{ emailClient: EmailClientPublic; status: Status }>(apiBase)
      .then((data) => {
        setVisible(true);
        setConfig(data.emailClient);
        setStatus(data.status);
        setSmtpPassword(data.emailClient.hasPassword ? PASSWORD_MASK : "");
      })
      .catch(() => setVisible(false));
  }, [apiBase]);

  const canEdit = useMemo(() => visible === true, [visible]);

  if (visible === null || !visible) return null;
  if (!config) return <p className="text-sm gs-muted">Loading email configuration…</p>;

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
      const data = await api<{ message: string; emailClient: EmailClientPublic; status: Status }>(apiBase, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setConfig(data.emailClient);
      setStatus(data.status);
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
      const refreshed = await api<{ emailClient: EmailClientPublic; status: Status }>(apiBase);
      setConfig(refreshed.emailClient);
      setStatus(refreshed.status);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to send test email. Please verify SMTP host, port, encryption, username and password.",
      );
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="gs-card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold gs-heading">{title}</h2>
          <p className="text-sm gs-muted">{description}</p>
        </div>
        {status ? (
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              status.tone === "success"
                ? "bg-emerald-100 text-emerald-800"
                : status.tone === "warning"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {status.tone === "success" ? "✓ " : status.tone === "warning" ? "⚠ " : ""}
            {status.label}
          </span>
        ) : null}
      </div>

      <div className="space-y-4">
        <label className="flex items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={config.enabled}
            disabled={!canEdit}
            onChange={(e) => setConfig((c) => (c ? { ...c, enabled: e.target.checked } : c))}
          />
          Enable Email Client
        </label>

        {isPlatform ? (
          <>
            <div>
              <h3 className="text-sm font-semibold gs-heading mb-2">Account</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <label className="text-sm">
                  Username
                  <input
                    className="gs-input mt-1"
                    value={config.smtpUsername}
                    onChange={(e) => setConfig((c) => (c ? { ...c, smtpUsername: e.target.value } : c))}
                  />
                </label>
                <label className="text-sm">
                  Password
                  <input
                    type="password"
                    className="gs-input mt-1"
                    value={smtpPassword}
                    placeholder={config.hasPassword ? PASSWORD_MASK : ""}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                  />
                </label>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold gs-heading mb-2">Incoming Mail</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <label className="text-sm md:col-span-2">
                  Incoming Server
                  <input
                    className="gs-input mt-1"
                    value={config.incomingServer}
                    onChange={(e) => setConfig((c) => (c ? { ...c, incomingServer: e.target.value } : c))}
                  />
                </label>
                <label className="text-sm">
                  IMAP Port
                  <input
                    type="number"
                    className="gs-input mt-1"
                    value={config.imapPort}
                    onChange={(e) => setConfig((c) => (c ? { ...c, imapPort: Number(e.target.value) } : c))}
                  />
                </label>
                <label className="text-sm">
                  POP3 Port
                  <input
                    type="number"
                    className="gs-input mt-1"
                    value={config.pop3Port}
                    onChange={(e) => setConfig((c) => (c ? { ...c, pop3Port: Number(e.target.value) } : c))}
                  />
                </label>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold gs-heading mb-2">Outgoing Mail</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <label className="text-sm md:col-span-2">
                  Outgoing Server
                  <input
                    className="gs-input mt-1"
                    value={config.smtpHost}
                    onChange={(e) => setConfig((c) => (c ? { ...c, smtpHost: e.target.value } : c))}
                  />
                </label>
                <label className="text-sm">
                  SMTP Port
                  <input
                    type="number"
                    className="gs-input mt-1"
                    value={config.smtpPort}
                    onChange={(e) => setConfig((c) => (c ? { ...c, smtpPort: Number(e.target.value) } : c))}
                  />
                </label>
                <label className="text-sm">
                  Encryption
                  <select
                    className="gs-input mt-1"
                    value={config.encryption}
                    onChange={(e) =>
                      setConfig((c) =>
                        c ? { ...c, encryption: e.target.value as EmailClientPublic["encryption"] } : c,
                      )
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
          </>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-sm md:col-span-2">
              SMTP Host
              <input
                className="gs-input mt-1"
                value={config.smtpHost}
                onChange={(e) => setConfig((c) => (c ? { ...c, smtpHost: e.target.value } : c))}
              />
            </label>
            <label className="text-sm">
              SMTP Port
              <input
                type="number"
                className="gs-input mt-1"
                value={config.smtpPort}
                onChange={(e) => setConfig((c) => (c ? { ...c, smtpPort: Number(e.target.value) } : c))}
              />
            </label>
            <label className="text-sm">
              Encryption
              <select
                className="gs-input mt-1"
                value={config.encryption}
                onChange={(e) =>
                  setConfig((c) =>
                    c ? { ...c, encryption: e.target.value as EmailClientPublic["encryption"] } : c,
                  )
                }
              >
                <option value="none">None</option>
                <option value="ssl">SSL</option>
                <option value="tls">TLS</option>
                <option value="starttls">STARTTLS</option>
              </select>
            </label>
            <label className="flex items-center gap-3 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={config.authEnabled}
                onChange={(e) => setConfig((c) => (c ? { ...c, authEnabled: e.target.checked } : c))}
              />
              Authentication enabled
            </label>
            <label className="text-sm">
              SMTP Username
              <input
                className="gs-input mt-1"
                value={config.smtpUsername}
                onChange={(e) => setConfig((c) => (c ? { ...c, smtpUsername: e.target.value } : c))}
              />
            </label>
            <label className="text-sm">
              SMTP Password
              <input
                type="password"
                className="gs-input mt-1"
                value={smtpPassword}
                placeholder={config.hasPassword ? PASSWORD_MASK : ""}
                onChange={(e) => setSmtpPassword(e.target.value)}
              />
            </label>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm">
            From Email
            <input
              type="email"
              className="gs-input mt-1"
              value={config.fromEmail}
              onChange={(e) => setConfig((c) => (c ? { ...c, fromEmail: e.target.value } : c))}
            />
          </label>
          <label className="text-sm">
            From Name
            <input
              className="gs-input mt-1"
              value={config.fromName}
              onChange={(e) => setConfig((c) => (c ? { ...c, fromName: e.target.value } : c))}
            />
          </label>
          <label className="text-sm md:col-span-2">
            Reply-To Email
            <input
              type="email"
              className="gs-input mt-1"
              value={config.replyToEmail}
              onChange={(e) => setConfig((c) => (c ? { ...c, replyToEmail: e.target.value } : c))}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-lg border px-4 py-2 text-sm gs-tab" onClick={() => setShowTest((v) => !v)}>
            Test Email Configuration
          </button>
          <button type="button" className="gs-btn px-4 py-2 text-sm" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save Configuration"}
          </button>
        </div>

        {showTest ? (
          <div className="rounded-lg border gs-border p-4 space-y-3">
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
              disabled={testing || !testTo}
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
