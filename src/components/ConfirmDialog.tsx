"use client";

import type { ReactNode } from "react";

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  busy = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-[#0b1b3a]">{title}</h2>
        <div className="mt-3 space-y-2 text-sm text-slate-600">{children}</div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="gs-btn px-4 py-2 text-sm" disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
