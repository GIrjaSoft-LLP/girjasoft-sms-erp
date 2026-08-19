"use client";

import { useEffect, useState } from "react";
import { APP_NAME } from "@/config/branding";
import { api } from "@/lib/client";

export default function PlatformGeneralSettingsPage() {
  const [form, setForm] = useState({ portalName: APP_NAME, supportEmail: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    Promise.all([
      api<{ settings: { portalName?: string; supportEmail?: string } }>("/api/platform/settings"),
      api<{ user: { permissions?: string[] } }>("/api/auth/me"),
    ])
      .then(([settings, me]) => {
        setForm({
          portalName: settings.settings.portalName ?? APP_NAME,
          supportEmail: settings.settings.supportEmail ?? "",
        });
        setCanEdit((me.user.permissions ?? []).includes("platform.settings.edit"));
      })
      .catch((err) => setError(err.message));
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api("/api/platform/settings", { method: "PATCH", body: JSON.stringify(form) });
      setMessage("Settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <form onSubmit={save} className="gs-card max-w-2xl space-y-4 p-5">
      <h2 className="text-lg font-semibold">General</h2>
      <label className="block text-sm">
        Portal name
        <input className="gs-input mt-1" value={form.portalName} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, portalName: e.target.value }))} />
      </label>
      <label className="block text-sm">
        Support email
        <input className="gs-input mt-1" type="email" value={form.supportEmail} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, supportEmail: e.target.value }))} />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {canEdit ? <button className="gs-btn px-4 py-2">Save Changes</button> : null}
    </form>
  );
}
