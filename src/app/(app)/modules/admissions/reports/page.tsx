"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type ReportData = Record<string, unknown>;

export default function AdmissionReportsPage() {
  const [report, setReport] = useState("summary");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const params = new URLSearchParams({ report });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const result = await api<ReportData>(`/api/admissions/reports?${params.toString()}`);
    setData(result);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report]);

  function exportCsv() {
    if (!data?.items || !Array.isArray(data.items) || data.items.length === 0) return;
    const rows = data.items as Record<string, unknown>[];
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(","), ...rows.map((row) => headers.map((h) => JSON.stringify(row[h] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admission-${report}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-sm">
          Report
          <select className="gs-input mt-1 block" value={report} onChange={(e) => setReport(e.target.value)}>
            <option value="summary">Summary</option>
            <option value="enquiries">Enquiries</option>
            <option value="applications">Applications</option>
            <option value="confirmed">Confirmed Admissions</option>
            <option value="pending">Pending Admissions</option>
            <option value="follow-ups">Follow-ups</option>
            <option value="conversion">Conversion</option>
          </select>
        </label>
        <label className="text-sm">
          From
          <input type="date" className="gs-input mt-1 block" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-sm">
          To
          <input type="date" className="gs-input mt-1 block" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="button" className="gs-btn px-4 py-2 text-sm" onClick={() => load().catch((err) => setError(err.message))}>
          Run Report
        </button>
        {Array.isArray(data?.items) ? (
          <button type="button" className="gs-btn px-4 py-2 text-sm bg-white border border-slate-200" onClick={exportCsv}>
            Export CSV
          </button>
        ) : null}
      </div>

      {error ? <p className="text-red-600">{error}</p> : null}

      {data ? (
        <div className="gs-card p-5 space-y-3">
          {report === "summary" || report === "conversion" ? (
            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              {Object.entries(data)
                .filter(([key]) => !["report", "items"].includes(key))
                .map(([key, value]) => (
                  <div key={key}>
                    <p className="text-slate-500 capitalize">{key.replace(/([A-Z])/g, " $1")}</p>
                    <p className="text-lg font-semibold">{String(value)}</p>
                  </div>
                ))}
            </div>
          ) : null}
          {Array.isArray(data.items) ? (
            <p className="text-sm text-slate-600">Total records: {data.items.length}</p>
          ) : null}
          <pre className="text-xs overflow-auto max-h-96 bg-slate-50 p-3 rounded-lg">{JSON.stringify(data, null, 2)}</pre>
        </div>
      ) : (
        <p className="text-slate-500">Loading report…</p>
      )}
    </div>
  );
}
