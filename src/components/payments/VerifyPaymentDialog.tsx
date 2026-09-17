"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { formatInr } from "@/components/fees/fee-pay-shared";

type PaymentDetail = {
  _id: string;
  studentName?: string;
  className?: string;
  sectionName?: string;
  feeHead?: string;
  amount?: number;
  date?: string;
  method?: string;
  transactionRef?: string;
  submittedByName?: string;
  submittedAt?: string;
  createdAt?: string;
  verificationStatus?: string;
  rejectionReason?: string;
  receiptFile?: { name?: string; url?: string; mime?: string };
};

export function VerifyPaymentDialog({
  paymentId,
  canVerify = false,
  onClose,
  onChanged,
}: {
  paymentId: string;
  canVerify?: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [item, setItem] = useState<PaymentDetail | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ item: PaymentDetail }>(`/api/payments/${paymentId}/verify`)
      .then((data) => setItem(data.item))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load receipt."));
  }, [paymentId]);

  async function act(action: "approve" | "reject") {
    setError("");
    if (action === "reject" && !reason.trim()) {
      setError("Enter a reason for rejecting this receipt.");
      return;
    }
    setSaving(true);
    try {
      await api(`/api/payments/${paymentId}/verify`, {
        method: "POST",
        body: JSON.stringify({ action, reason }),
      });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update payment.");
    } finally {
      setSaving(false);
    }
  }

  const receiptUrl = item?.receiptFile?.url ?? "";
  const isImage = /\.(png|jpe?g|webp)(\?|$)/i.test(receiptUrl) || String(item?.receiptFile?.mime ?? "").startsWith("image/");
  const pending = item?.verificationStatus === "PENDING_VERIFICATION";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="gs-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-[#0b1b3a]">Payment Receipt</h2>
          <button type="button" className="text-sm text-slate-500" onClick={onClose}>
            Close
          </button>
        </div>
        {error && !item ? <p className="text-sm text-red-600">{error}</p> : null}
        {!error && !item ? <p className="text-sm text-slate-500">Loading receipt…</p> : null}
        {item ? (
          <div className="space-y-3 text-sm">
            <div className="grid gap-2 md:grid-cols-2">
              <p>
                <span className="text-slate-500">Student:</span> {item.studentName || "—"}
              </p>
              <p>
                <span className="text-slate-500">Class:</span> {[item.className, item.sectionName].filter(Boolean).join(" - ") || "—"}
              </p>
              <p>
                <span className="text-slate-500">Fee:</span> {item.feeHead || "—"}
              </p>
              <p>
                <span className="text-slate-500">Amount:</span> {formatInr(item.amount)}
              </p>
              <p>
                <span className="text-slate-500">Payment Date:</span> {item.date || "—"}
              </p>
              <p>
                <span className="text-slate-500">Payment Method:</span> {item.method || "—"}
              </p>
              <p>
                <span className="text-slate-500">Transaction/UTR:</span> {item.transactionRef || "—"}
              </p>
              <p>
                <span className="text-slate-500">Parent:</span> {item.submittedByName || "—"}
              </p>
              <p>
                <span className="text-slate-500">Submitted:</span>{" "}
                {item.submittedAt || item.createdAt ? new Date(String(item.submittedAt || item.createdAt)).toLocaleString() : "—"}
              </p>
              <p>
                <span className="text-slate-500">Status:</span> {item.verificationStatus || "—"}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <h3 className="mb-2 font-semibold text-[#0b1b3a]">Uploaded receipt</h3>
              {receiptUrl ? (
                isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={receiptUrl} alt="Uploaded payment receipt" className="max-h-96 w-full object-contain" />
                ) : (
                  <a className="text-[#4c7eff]" href={receiptUrl} target="_blank" rel="noreferrer">
                    {item.receiptFile?.name || "Open receipt"}
                  </a>
                )
              ) : (
                <p className="text-slate-500">No file attached.</p>
              )}
            </div>

            {pending && canVerify ? (
              <label className="block">
                <span className="mb-1 block text-slate-600">Rejection reason</span>
                <textarea className="gs-input min-h-20" value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
            ) : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button type="button" className="rounded-lg border px-4 py-2" onClick={onClose}>
                Close
              </button>
              {pending && canVerify ? (
                <>
                  <button type="button" className="rounded-lg border border-red-200 px-4 py-2 text-red-700" disabled={saving} onClick={() => void act("reject")}>
                    Reject
                  </button>
                  <button type="button" className="gs-btn px-4 py-2" disabled={saving} onClick={() => void act("approve")}>
                    Approve
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
