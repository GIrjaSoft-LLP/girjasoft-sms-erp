"use client";

import type { ReactNode } from "react";

export function RecordDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="gs-card w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-[#0b1b3a]">{title}</h2>
          <button type="button" className="text-sm text-slate-500" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
