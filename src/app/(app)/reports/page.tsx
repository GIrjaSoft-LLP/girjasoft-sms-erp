"use client";

import { useEffect, useState } from "react";
import { DocumentLetterhead, type Letterhead } from "@/components/DocumentLetterhead";
import { APP_NAME, COMPANY_NAME } from "@/config/branding";
import { api } from "@/lib/client";

export default function ReportsPage() {
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [audit, setAudit] = useState<Array<Record<string, unknown>>>([]);
  const [letterhead, setLetterhead] = useState<Letterhead | null>(null);

  useEffect(() => {
    api<{ stats: Record<string, number> }>("/api/reports?type=summary").then((d) => setSummary(d.stats ?? {}));
    api<{ items: Array<Record<string, unknown>> }>("/api/reports?type=audit").then((d) => setAudit(d.items ?? []));
    api<{ letterhead: Letterhead }>("/api/workspace/letterhead").then((d) => setLetterhead(d.letterhead));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <p className="text-sm text-slate-500">{APP_NAME} · {COMPANY_NAME}</p>
          <h1 className="text-2xl font-semibold">Reports</h1>
        </div>
        <button className="gs-btn px-4 py-2" onClick={() => window.print()}>
          Print / Export
        </button>
      </div>
      <div className="gs-card p-6 document-sheet">
        {letterhead ? (
          <DocumentLetterhead letterhead={letterhead} title="Workspace Report" />
        ) : null}
        <div className="grid md:grid-cols-4 gap-4">
          {Object.entries(summary).map(([key, value]) => (
            <div key={key} className="border border-slate-100 rounded-xl p-4">
              <div className="capitalize text-sm text-slate-500">{key}</div>
              <div className="text-2xl font-semibold">{value}</div>
            </div>
          ))}
        </div>
        <h2 className="mt-6 mb-2 font-semibold">Workspace audit log</h2>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-3">Time</th>
              <th className="p-3">Actor</th>
              <th className="p-3">Action</th>
              <th className="p-3">Entity</th>
            </tr>
          </thead>
          <tbody>
            {audit.map((row) => (
              <tr key={String(row._id)} className="border-t">
                <td className="p-3">{String(row.createdAt ?? "")}</td>
                <td className="p-3">{String(row.actorEmail ?? "")}</td>
                <td className="p-3">{String(row.action ?? "")}</td>
                <td className="p-3">{String(row.entity ?? "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
