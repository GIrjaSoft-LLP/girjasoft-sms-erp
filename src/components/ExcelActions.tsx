"use client";

import { useRef, useState } from "react";

type Props = {
  exportUrl: string;
  importUrl: string;
  templateUrl: string;
  onImported: () => Promise<void> | void;
};

async function download(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || "Download failed");
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const name = match?.[1] ?? "export.xlsx";
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  link.click();
  URL.revokeObjectURL(href);
}

export function ExcelActions({ exportUrl, importUrl, templateUrl, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(importUrl, { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Import failed");
      setMessage(
        `Imported ${data.created ?? 0} row(s). Skipped ${data.skipped ?? 0}. Errors: ${data.errors?.length ?? 0}.`,
      );
      await onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        onClick={() => download(templateUrl).catch((err) => setError(err.message))}
      >
        Download template
      </button>
      <button
        type="button"
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        onClick={() => download(exportUrl).catch((err) => setError(err.message))}
      >
        Export Excel
      </button>
      <button
        type="button"
        className="gs-btn px-3 py-2 text-sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Importing…" : "Import Excel"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      {message ? <span className="text-sm text-emerald-700">{message}</span> : null}
      {error ? <span className="text-sm text-red-600">{error}</span> : null}
    </div>
  );
}
