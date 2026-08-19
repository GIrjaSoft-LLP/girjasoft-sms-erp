"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { APPLICATION_STATUSES } from "@/config/admissions";
import { api } from "@/lib/client";

type Application = {
  _id: string;
  applicationNumber: string;
  student?: { name?: string };
  father?: { name?: string; mobile?: string };
  applicationDate: string;
  status: string;
  fees?: { due?: number; paid?: number };
  admissionNumber?: string;
};

export default function ApplicationsPage() {
  const [items, setItems] = useState<Application[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const data = await api<{ items: Application[] }>(`/api/admissions/applications${suffix}`);
    setItems(data.items);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-sm">
          Search
          <input className="gs-input mt-1 block" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Application no., name, mobile" />
        </label>
        <label className="text-sm">
          Status
          <select className="gs-input mt-1 block" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="gs-btn px-4 py-2 text-sm" onClick={() => load().catch((err) => setError(err.message))}>
          Search
        </button>
        <Link href="/modules/admissions/applications/new" className="gs-btn px-4 py-2 text-sm ml-auto">
          New Application
        </Link>
      </div>

      {error ? <p className="text-red-600">{error}</p> : null}

      <div className="gs-card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-3">Application No.</th>
              <th className="p-3">Applicant</th>
              <th className="p-3">Parent</th>
              <th className="p-3">Mobile</th>
              <th className="p-3">Date</th>
              <th className="p-3">Payment</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row._id} className="border-t border-slate-100">
                <td className="p-3">{row.applicationNumber}</td>
                <td className="p-3">{row.student?.name || "—"}</td>
                <td className="p-3">{row.father?.name || "—"}</td>
                <td className="p-3">{row.father?.mobile || "—"}</td>
                <td className="p-3">{row.applicationDate}</td>
                <td className="p-3">
                  Paid ₹{row.fees?.paid ?? 0} / Due ₹{row.fees?.due ?? 0}
                </td>
                <td className="p-3">{row.status.replace(/_/g, " ")}</td>
                <td className="p-3">
                  <Link href={`/modules/admissions/applications/${row._id}`} className="text-[#4c7eff]">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 ? <p className="p-4 text-slate-500">No applications found.</p> : null}
      </div>
    </div>
  );
}
