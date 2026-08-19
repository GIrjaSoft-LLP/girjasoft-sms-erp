"use client";

import { useEffect, useState } from "react";
import type { AdmissionSettings } from "@/config/admissions";
import { DEFAULT_ADMISSION_DOCUMENTS } from "@/config/admissions";
import { api } from "@/lib/client";

export default function AdmissionSettingsPage() {
  const [settings, setSettings] = useState<AdmissionSettings | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api<{ settings: AdmissionSettings }>("/api/admissions/settings")
      .then((data) => setSettings(data.settings))
      .catch((err) => setError(err.message));
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setError("");
    try {
      const data = await api<{ settings: AdmissionSettings }>("/api/admissions/settings", {
        method: "PATCH",
        body: JSON.stringify(settings),
      });
      setSettings(data.settings);
      setMessage("Admission settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  if (!settings) return <p className="text-slate-500">Loading settings…</p>;

  return (
    <form onSubmit={save} className="space-y-6 max-w-4xl">
      <h2 className="text-xl font-semibold">Admission Settings</h2>

      <div className="gs-card p-5 grid md:grid-cols-2 gap-3">
        <h3 className="md:col-span-2 font-semibold">ID Configuration</h3>
        <label className="text-sm">
          Admission Number Format
          <input className="gs-input mt-1" value={settings.admissionNumberFormat} onChange={(e) => setSettings((s) => s && ({ ...s, admissionNumberFormat: e.target.value }))} />
        </label>
        <label className="text-sm">
          Application Number Format
          <input className="gs-input mt-1" value={settings.applicationNumberFormat} onChange={(e) => setSettings((s) => s && ({ ...s, applicationNumberFormat: e.target.value }))} />
        </label>
        <label className="text-sm">
          Roll Number Prefix
          <input className="gs-input mt-1" value={settings.rollNumberPrefix} onChange={(e) => setSettings((s) => s && ({ ...s, rollNumberPrefix: e.target.value }))} />
        </label>
      </div>

      <div className="gs-card p-5 grid md:grid-cols-2 gap-3">
        <h3 className="md:col-span-2 font-semibold">Workflow</h3>
        {(
          [
            ["autoCreateStudent", "Automatic student creation"],
            ["autoCreateParentAccount", "Automatic parent account creation"],
            ["requireDocumentVerification", "Require document verification"],
            ["requirePaymentBeforeConfirm", "Require payment before confirmation"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={Boolean(settings[key])}
              onChange={(e) => setSettings((s) => s && ({ ...s, [key]: e.target.checked }))}
            />
            {label}
          </label>
        ))}
      </div>

      <div className="gs-card p-5 grid md:grid-cols-2 gap-3">
        <h3 className="md:col-span-2 font-semibold">Fee Heads (Admission)</h3>
        {Object.entries(settings.feeHeads).map(([key, value]) => (
          <label key={key} className="text-sm capitalize">
            {key.replace(/([A-Z])/g, " $1")}
            <input
              type="number"
              className="gs-input mt-1"
              value={value}
              onChange={(e) =>
                setSettings((s) =>
                  s
                    ? {
                        ...s,
                        feeHeads: { ...s.feeHeads, [key]: Number(e.target.value) },
                      }
                    : s,
                )
              }
            />
          </label>
        ))}
      </div>

      <div className="gs-card p-5 space-y-3">
        <h3 className="font-semibold">Documents</h3>
        {(settings.documents ?? DEFAULT_ADMISSION_DOCUMENTS).map((doc, index) => (
          <div key={doc.key} className="flex flex-wrap items-center gap-3 text-sm">
            <input
              className="gs-input flex-1 min-w-[180px]"
              value={doc.name}
              onChange={(e) =>
                setSettings((s) => {
                  if (!s) return s;
                  const documents = s.documents.map((row, i) =>
                    i === index ? { ...row, name: e.target.value } : row,
                  );
                  return { ...s, documents };
                })
              }
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={doc.mandatory}
                onChange={(e) =>
                  setSettings((s) => {
                    if (!s) return s;
                    const documents = s.documents.map((row, i) =>
                      i === index ? { ...row, mandatory: e.target.checked } : row,
                    );
                    return { ...s, documents };
                  })
                }
              />
              Mandatory
            </label>
          </div>
        ))}
      </div>

      {error ? <p className="text-red-600">{error}</p> : null}
      {message ? <p className="text-emerald-700">{message}</p> : null}
      <button className="gs-btn px-4 py-2">Save admission settings</button>
    </form>
  );
}
