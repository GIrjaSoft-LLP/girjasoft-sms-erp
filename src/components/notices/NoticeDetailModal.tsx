"use client";

import { useEffect } from "react";

export type NoticeDetail = {
  title: string;
  body: string;
  date?: string;
  audience?: string;
  createdAt?: string;
  updatedAt?: string;
};

function formatDisplayDate(value?: string) {
  if (!value) return "—";
  const isoDay = value.slice(0, 10);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(isoDay)
    ? new Date(`${isoDay}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function NoticeDetailModal({
  notice,
  loading,
  error,
  onClose,
}: {
  notice: NoticeDetail | null;
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="gs-card flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden p-6"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notice-detail-title"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="notice-detail-title" className="text-lg font-semibold gs-heading">
            {loading ? "Notice" : notice?.title || "Notice"}
          </h2>
          <button type="button" className="text-lg leading-none text-slate-500" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {loading ? <p className="text-sm gs-muted">Loading notice…</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {!loading && !error && notice ? (
            <div className="space-y-4 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <p>
                  <span className="gs-muted">Date: </span>
                  {formatDisplayDate(notice.date)}
                </p>
                <p>
                  <span className="gs-muted">Audience: </span>
                  {notice.audience || "Everyone"}
                </p>
                <p>
                  <span className="gs-muted">Published: </span>
                  {formatDisplayDate(notice.createdAt)}
                </p>
              </div>
              <div className="whitespace-pre-wrap break-words leading-6 text-slate-800">
                {notice.body?.trim() ? notice.body : "No additional message was provided."}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex justify-end">
          <button type="button" className="gs-btn px-4 py-2 text-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
