"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { classLabel, formatInr, type FeePayInfo } from "@/components/fees/fee-pay-shared";

const METHODS = [
  { value: "UPI", label: "UPI" },
  { value: "BANK", label: "Bank Transfer" },
  { value: "QR", label: "QR" },
  { value: "OTHER", label: "Other" },
];

export function UploadReceiptDialog({
  feeId,
  onClose,
  onUploaded,
}: {
  feeId: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [info, setInfo] = useState<FeePayInfo | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("UPI");
  const [transactionRef, setTransactionRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<FeePayInfo>(`/api/fees/${feeId}/pay-info`)
      .then((data) => {
        setInfo(data);
        setAmount(String(data.fee.dueAmount ?? ""));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load fee details."));
  }, [feeId]);

  async function submit() {
    setError("");
    const due = Number(info?.fee.dueAmount ?? 0);
    const paid = Number(amount);
    if (!Number.isFinite(paid) || paid <= 0) {
      setError("Enter a valid amount paid.");
      return;
    }
    if (paid - due > 0.0001) {
      setError(`Amount cannot exceed the outstanding due of ${formatInr(due)}.`);
      return;
    }
    if (!date) {
      setError("Enter the payment date.");
      return;
    }
    if (!file) {
      setError("Choose a receipt file.");
      return;
    }
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    const name = file.name.toLowerCase();
    const okType =
      allowed.includes(file.type) || name.endsWith(".pdf") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png");
    if (!okType) {
      setError("Receipt must be a PDF, JPG or PNG file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Receipt must be 5 MB or smaller.");
      return;
    }

    setSaving(true);
    try {
      const body = new FormData();
      body.append("amount", String(paid));
      body.append("date", date);
      body.append("method", method);
      body.append("transactionRef", transactionRef);
      body.append("file", file);
      const response = await fetch(`/api/fees/${feeId}/receipt`, { method: "POST", body, credentials: "include" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Upload failed");
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSaving(false);
    }
  }

  const fee = info?.fee;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="gs-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-[#0b1b3a]">Upload Payment Receipt</h2>
          <button type="button" className="text-sm text-slate-500" onClick={onClose}>
            Close
          </button>
        </div>
        {error && !fee ? <p className="text-sm text-red-600">{error}</p> : null}
        {!error && !info ? <p className="text-sm text-slate-500">Loading…</p> : null}
        {fee ? (
          <div className="space-y-3 text-sm">
            <p>
              <span className="text-slate-500">Student:</span> {fee.studentName}
              {classLabel(fee) ? ` · ${classLabel(fee)}` : ""}
            </p>
            <p>
              <span className="text-slate-500">Fee:</span> {fee.feeHead}
            </p>
            <p>
              <span className="text-slate-500">Amount Due:</span> {formatInr(fee.dueAmount)}
            </p>
            {info?.review?.status === "REJECTED" ? (
              <p className="rounded-lg bg-red-50 p-3 text-red-700">
                Previous receipt was rejected{info.review.rejectionReason ? `: ${info.review.rejectionReason}` : "."} Upload
                a corrected receipt.
              </p>
            ) : null}
            <label className="block">
              <span className="mb-1 block text-slate-600">Payment Date</span>
              <input className="gs-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-slate-600">Amount Paid</span>
              <input className="gs-input" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-slate-600">Payment Method</span>
              <select className="gs-input" value={method} onChange={(e) => setMethod(e.target.value)}>
                {METHODS.map((row) => (
                  <option key={row.value} value={row.value}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-slate-600">Transaction / UTR Number</span>
              <input className="gs-input" value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-slate-600">Upload Receipt</span>
              <input
                className="gs-input"
                type="file"
                accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <span className="mt-1 block text-xs text-slate-500">PDF, JPG or PNG. Max 5 MB.</span>
            </label>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="rounded-lg border px-4 py-2" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="gs-btn px-4 py-2" disabled={saving} onClick={() => void submit()}>
                {saving ? "Uploading…" : "Upload Payment"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
