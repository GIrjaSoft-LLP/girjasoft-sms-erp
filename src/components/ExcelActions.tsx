"use client";

import { useRef, useState } from "react";

type ImportResult = {
  total?: number;
  created?: number;
  skipped?: number;
  failed?: number;
  errors?: string[];
  errorReport?: string;
};

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
  const [errorReport, setErrorReport] = useState("");
  const [busy, setBusy] = useState(false);

  function downloadErrorReport(report: string, filename: string) {
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(href);
  }

  async function upload(file: File) {
    setBusy(true);
    setError("");
    setMessage("");
    setErrorReport("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(importUrl, { method: "POST", body });
      const data = (await response.json()) as ImportResult;
      if (!response.ok) throw new Error((data as { error?: string }).error || "Import failed");
      const failed = data.failed ?? data.errors?.length ?? 0;
      setMessage(
        `Total: ${data.total ?? 0} · Imported: ${data.created ?? 0} · Skipped: ${data.skipped ?? 0} · Failed: ${failed}`,
      );
      setErrorReport(data.errorReport ?? "");
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
      {errorReport ? (
        <button
          type="button"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          onClick={() => downloadErrorReport(errorReport, "import-errors.txt")}
        >
          Download error report
        </button>
      ) : null}
      {error ? <span className="text-sm text-red-600">{error}</span> : null}
    </div>
  );
}
