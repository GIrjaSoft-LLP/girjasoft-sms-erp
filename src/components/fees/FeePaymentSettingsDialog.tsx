"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";

export type SchoolPaymentDetails = {
  accountName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
  upiId: string;
  qrCodeUrl: string;
  currency: string;
};

const EMPTY: SchoolPaymentDetails = {
  accountName: "",
  bankName: "",
  accountNumber: "",
  ifscCode: "",
  branch: "",
  upiId: "",
  qrCodeUrl: "",
  currency: "INR",
};

export function FeePaymentSettingsDialog({ onClose }: { onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api<{ payment: SchoolPaymentDetails }>("/api/fees/payment-settings")
      .then((data) => setForm({ ...EMPTY, ...data.payment }))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load payment details."));
  }, []);

  function setField(key: keyof SchoolPaymentDetails, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setError("");
    setSaving(true);
    try {
      const data = await api<{ payment: SchoolPaymentDetails }>("/api/fees/payment-settings", {
        method: "PATCH",
        body: JSON.stringify({
          accountName: form.accountName,
          bankName: form.bankName,
          accountNumber: form.accountNumber,
          ifscCode: form.ifscCode,
          branch: form.branch,
          upiId: form.upiId,
        }),
      });
      setForm((current) => ({ ...current, ...data.payment }));
      setMessage("Payment details saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save payment details.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadQr(file: File) {
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/fees/payment-settings/qr", { method: "POST", body, credentials: "include" });
      const data = (await response.json()) as { payment?: SchoolPaymentDetails; error?: string };
      if (!response.ok) throw new Error(data.error || "Upload failed");
      if (data.payment) setForm((current) => ({ ...current, ...data.payment }));
      setMessage("QR code uploaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeQr() {
    setError("");
    const response = await fetch("/api/fees/payment-settings/qr", { method: "DELETE", credentials: "include" });
    const data = (await response.json()) as { payment?: SchoolPaymentDetails; error?: string };
    if (!response.ok) {
      setError(data.error || "Could not remove QR code.");
      return;
    }
    if (data.payment) setForm((current) => ({ ...current, ...data.payment }));
    setMessage("QR code removed.");
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="gs-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#0b1b3a]">Fee Payment Settings</h2>
            <p className="text-sm text-slate-500">Bank and UPI details shown to parents for this school only.</p>
          </div>
          <button type="button" className="text-sm text-slate-500" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {(
            [
              ["accountName", "Account Name"],
              ["bankName", "Bank Name"],
              ["accountNumber", "Account Number"],
              ["ifscCode", "IFSC Code"],
              ["branch", "Branch"],
              ["upiId", "UPI ID"],
            ] as Array<[keyof SchoolPaymentDetails, string]>
          ).map(([key, label]) => (
            <label key={key} className="text-sm">
              <span className="mb-1 block text-slate-600">{label}</span>
              <input className="gs-input" value={form[key]} onChange={(e) => setField(key, e.target.value)} />
            </label>
          ))}
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-[#0b1b3a]">QR Code</h3>
          <p className="mt-1 text-xs text-slate-500">PNG, JPG or WEBP. Max 2 MB. Parents see this on Pay.</p>
          <div className="mt-3 flex flex-wrap items-start gap-4">
            <div className="grid h-40 w-40 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              {form.qrCodeUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.qrCodeUrl} alt="School payment QR code" className="h-full w-full object-contain" />
              ) : (
                <span className="px-3 text-center text-xs text-slate-400">No QR code</span>
              )}
            </div>
            <div className="space-y-2">
              <button type="button" className="gs-btn px-4 py-2 text-sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? "Uploading…" : form.qrCodeUrl ? "Replace QR code" : "Upload QR code"}
              </button>
              {form.qrCodeUrl ? (
                <button type="button" className="block text-sm text-red-600" onClick={() => void removeQr()}>
                  Remove QR code
                </button>
              ) : null}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadQr(file);
              }}
            />
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={onClose}>
            Close
          </button>
          <button type="button" className="gs-btn px-4 py-2 text-sm" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save payment details"}
          </button>
        </div>
      </div>
    </div>
  );
}
