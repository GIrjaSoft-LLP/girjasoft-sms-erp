"use client";

import { useEffect, useRef, useState } from "react";
import { EmailClientSection } from "@/components/EmailClientSection";
import { api } from "@/lib/client";

export default function SettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [org, setOrg] = useState({
    schoolName: "",
    logo: "",
    address: "",
    phone: "",
    email: "",
    website: "",
  });
  const [finance, setFinance] = useState({ currency: "INR", receiptPrefix: "GS" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api<{ workspace: typeof org; settings: { finance?: typeof finance; organization?: typeof org } }>("/api/settings")
      .then((data) => {
        setOrg({
          schoolName: data.workspace?.schoolName ?? "",
          logo: data.workspace?.logo ?? "",
          address: data.workspace?.address ?? "",
          phone: data.workspace?.phone ?? "",
          email: data.workspace?.email ?? "",
          website: data.workspace?.website ?? "",
        });
        setFinance({
          currency: String(data.settings?.finance?.currency ?? "INR"),
          receiptPrefix: String(data.settings?.finance?.receiptPrefix ?? "GS"),
        });
      })
      .catch(() => undefined);
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    await api("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({
        workspace: { ...org, logo: org.logo },
        organization: org,
        finance,
      }),
    });
    setMessage("Settings saved. The school logo will appear on bills, invoices, receipts and payroll slips.");
  }

  async function uploadLogo(file: File) {
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/settings/logo", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed");
      setOrg((current) => ({ ...current, logo: data.logo }));
      setMessage("School logo uploaded. It will be used on invoices, fee receipts, payroll slips and reports.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeLogo() {
    setError("");
    await fetch("/api/settings/logo", { method: "DELETE" });
    setOrg((current) => ({ ...current, logo: "" }));
    setMessage("School logo removed.");
  }

  return (
    <form onSubmit={save} className="space-y-6 max-w-3xl">
      <h2 className="text-xl font-semibold">Organization</h2>
      <div className="gs-card p-5 space-y-4">
        <h2 className="font-semibold">School logo</h2>
        <p className="text-sm text-slate-500">
          Upload the school logo. It is shown on the workspace sidebar and on fee receipts, invoices,
          payroll slips, bills, result sheets and printable reports.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <div className="h-24 w-24 rounded-xl border border-slate-200 bg-slate-50 grid place-items-center overflow-hidden">
            {org.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo} alt="School logo" className="h-full w-full object-contain" />
            ) : (
              <span className="text-xs text-slate-400 text-center px-2">No logo</span>
            )}
          </div>
          <div className="space-y-2">
            <button
              type="button"
              className="gs-btn px-4 py-2 text-sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? "Uploading…" : "Upload logo"}
            </button>
            {org.logo ? (
              <button type="button" className="block text-sm text-red-600" onClick={removeLogo}>
                Remove logo
              </button>
            ) : null}
            <p className="text-xs text-slate-500">PNG, JPG, WEBP or GIF. Max 2 MB.</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadLogo(file);
            }}
          />
        </div>
      </div>
      <div className="gs-card p-5 grid md:grid-cols-2 gap-3">
        <h2 className="md:col-span-2 font-semibold">Organization</h2>
        {(["schoolName", "address", "phone", "email", "website"] as const).map((key) => (
          <label key={key} className="text-sm capitalize">
            {key === "schoolName" ? "School name" : key}
            <input
              className="gs-input mt-1"
              value={org[key]}
              onChange={(e) => setOrg((o) => ({ ...o, [key]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      <EmailClientSection />
      <div className="gs-card p-5 grid md:grid-cols-2 gap-3">
        <h2 className="md:col-span-2 font-semibold">Finance</h2>
        <label className="text-sm">
          Currency
          <input className="gs-input mt-1" value={finance.currency} onChange={(e) => setFinance((f) => ({ ...f, currency: e.target.value }))} />
        </label>
        <label className="text-sm">
          Receipt prefix
          <input className="gs-input mt-1" value={finance.receiptPrefix} onChange={(e) => setFinance((f) => ({ ...f, receiptPrefix: e.target.value }))} />
        </label>
      </div>
      {error ? <p className="text-red-600">{error}</p> : null}
      {message ? <p className="text-emerald-700">{message}</p> : null}
      <button className="gs-btn px-4 py-2">Save settings</button>
    </form>
  );
}
