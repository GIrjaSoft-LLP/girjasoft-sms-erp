"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { classLabel, formatInr, type FeePayInfo } from "@/components/fees/fee-pay-shared";

export function PayFeeDialog({
  feeId,
  onClose,
  onUpload,
}: {
  feeId: string;
  onClose: () => void;
  onUpload: () => void;
}) {
  const [info, setInfo] = useState<FeePayInfo | null>(null);
  const [error, setError] = useState("");
  const [qrFailed, setQrFailed] = useState(false);

  useEffect(() => {
    api<FeePayInfo>(`/api/fees/${feeId}/pay-info`)
      .then((data) => setInfo(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load payment details."));
  }, [feeId]);

  const fee = info?.fee;
  const payment = info?.payment;
  const due = fee?.dueAmount ?? 0;

  function proceed() {
    if (!payment?.upiId || !fee) return;
    const params = new URLSearchParams({
      pa: payment.upiId,
      pn: payment.accountName || "School Fee",
      am: String(due),
      cu: "INR",
      tn: fee.feeHead || "School Fee",
    });
    window.location.href = `upi://pay?${params.toString()}`;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="gs-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-[#0b1b3a]">Pay School Fee</h2>
          <button type="button" className="text-sm text-slate-500" onClick={onClose}>
            Close
          </button>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {!error && !info ? <p className="text-sm text-slate-500">Loading payment details…</p> : null}
        {fee && payment ? (
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-slate-200 p-3 space-y-1">
              <p>
                <span className="text-slate-500">Student Name:</span> {fee.studentName}
              </p>
              <p>
                <span className="text-slate-500">Class:</span> {classLabel(fee) || "—"}
              </p>
              <p>
                <span className="text-slate-500">Fee:</span> {fee.feeHead}
              </p>
              <p>
                <span className="text-slate-500">Amount Due:</span> {formatInr(due)}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 p-4 text-center">
              {payment.qrCodeUrl && !qrFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={payment.qrCodeUrl}
                  alt="School payment QR code"
                  className="mx-auto max-h-56 w-full max-w-[240px] object-contain"
                  onError={() => setQrFailed(true)}
                />
              ) : (
                <p className="text-sm text-amber-800">
                  QR code payment is currently unavailable. Please use the bank account details below or contact the
                  school.
                </p>
              )}
              {payment.qrCodeUrl && !qrFailed ? (
                <p className="mt-2 text-slate-600">Scan &amp; pay using UPI</p>
              ) : null}
            </div>

            <div className="rounded-lg border border-slate-200 p-3 space-y-1">
              <h3 className="font-semibold text-[#0b1b3a]">School Account Details</h3>
              <p>
                <span className="text-slate-500">Account Name:</span> {payment.accountName || "—"}
              </p>
              <p>
                <span className="text-slate-500">Bank Name:</span> {payment.bankName || "—"}
              </p>
              <p>
                <span className="text-slate-500">Account Number:</span> {payment.accountNumber || "—"}
              </p>
              <p>
                <span className="text-slate-500">IFSC Code:</span> {payment.ifscCode || "—"}
              </p>
              <p>
                <span className="text-slate-500">Branch:</span> {payment.branch || "—"}
              </p>
              <p>
                <span className="text-slate-500">UPI ID:</span> {payment.upiId || "—"}
              </p>
            </div>

            <p className="font-medium">Amount to Pay: {formatInr(due)}</p>
            {info.review?.status === "REJECTED" ? (
              <p className="rounded-lg bg-red-50 p-3 text-red-700">
                Previous receipt was rejected{info.review.rejectionReason ? `: ${info.review.rejectionReason}` : "."}
              </p>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="gs-btn px-4 py-2 text-sm"
                onClick={() => {
                  if (payment.upiId) proceed();
                  else onUpload();
                }}
              >
                Proceed to Payment
              </button>
              <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={onUpload}>
                Upload receipt
              </button>
              <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
