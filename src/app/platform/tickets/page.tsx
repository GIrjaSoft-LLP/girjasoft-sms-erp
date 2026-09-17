"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ticketLabel } from "@/config/tickets";
import { api } from "@/lib/client";

type Ticket = {
  _id: string;
  ticketNumber: string;
  schoolName: string;
  subject: string;
  type: string;
  priority: string;
  status: string;
  createdByName: string;
  createdAt: string;
};

type Payload = {
  items: Ticket[];
  total: number;
  page: number;
  limit: number;
  stats: Record<string, number>;
  modules: string[];
  workspaces: Array<{ id: string; schoolName: string; code: string }>;
};

const emptyFilters = {
  q: "",
  workspaceId: "",
  type: "",
  status: "",
  priority: "",
  module: "",
  from: "",
  to: "",
};

export default function PlatformTicketsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  async function load(nextPage = page, nextFilters = filters) {
    const params = new URLSearchParams({ page: String(nextPage), limit: "20" });
    Object.entries(nextFilters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const result = await api<Payload>(`/api/platform/tickets?${params.toString()}`);
    setData(result);
    setPage(nextPage);
  }

  useEffect(() => {
    load(1, filters).catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = data?.stats ?? {};
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.limit ?? 20)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#0b1b3a]">Tickets</h1>
        <p className="text-sm text-slate-500">Support requests routed to GirjaSoft from school administrative users.</p>
      </div>
      {error ? <p className="text-red-600">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {[
          ["Total", stats.total],
          ["Open", stats.open],
          ["Assigned", stats.assigned],
          ["In Progress", stats.inProgress],
          ["Waiting", stats.waiting],
          ["Resolved", stats.resolved],
          ["Closed", stats.closed],
          ["Critical", stats.critical],
        ].map(([label, value]) => (
          <div key={String(label)} className="gs-card p-3">
            <div className="text-xs text-slate-500">{label}</div>
            <div className="text-xl font-semibold">{value ?? 0}</div>
          </div>
        ))}
      </div>
      <div className="gs-card grid gap-3 p-4 md:grid-cols-6">
        <input className="gs-input md:col-span-2" placeholder="Search" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
        <select className="gs-input" value={filters.workspaceId} onChange={(e) => setFilters((f) => ({ ...f, workspaceId: e.target.value }))}>
          <option value="">All schools</option>
          {(data?.workspaces ?? []).map((row) => (
            <option key={row.id} value={row.id}>
              {row.schoolName} ({row.code})
            </option>
          ))}
        </select>
        <select className="gs-input" value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
          <option value="">All types</option>
          <option value="INCIDENT">Incident</option>
          <option value="REQUEST">Request</option>
        </select>
        <select className="gs-input" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="WAITING_FOR_SCHOOL">Waiting for School</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
        <select className="gs-input" value={filters.priority} onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}>
          <option value="">All priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </select>
        <select className="gs-input" value={filters.module} onChange={(e) => setFilters((f) => ({ ...f, module: e.target.value }))}>
          <option value="">All modules</option>
          {(data?.modules ?? []).map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <input className="gs-input" type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
        <input className="gs-input" type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
        <div className="flex gap-2 md:col-span-2">
          <button type="button" className="gs-btn px-4 py-2" onClick={() => load(1, filters).catch((err) => setError(err.message))}>
            Search
          </button>
          <button type="button" className="px-3 py-2 text-sm" onClick={() => { setFilters(emptyFilters); load(1, emptyFilters).catch((err) => setError(err.message)); }}>
            Reset
          </button>
        </div>
      </div>
      <div className="gs-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              {["Ticket ID", "School", "Subject", "Type", "Priority", "Status", "Created By", "Created"].map((col) => (
                <th key={col} className="p-3 font-medium">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((item) => (
              <tr key={item._id} className="border-t">
                <td className="p-3">
                  <Link className="font-medium text-[#4c7eff]" href={`/platform/tickets/${item._id}`}>
                    {item.ticketNumber}
                  </Link>
                </td>
                <td className="p-3">{item.schoolName}</td>
                <td className="p-3">{item.subject}</td>
                <td className="p-3">{ticketLabel(item.type)}</td>
                <td className="p-3">{ticketLabel(item.priority)}</td>
                <td className="p-3">{ticketLabel(item.status)}</td>
                <td className="p-3">{item.createdByName}</td>
                <td className="p-3">{new Date(item.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {!data?.items.length ? (
              <tr>
                <td className="p-4 text-slate-500" colSpan={8}>
                  No tickets match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-2 text-sm">
        <button type="button" disabled={page <= 1} onClick={() => load(page - 1).catch((err) => setError(err.message))}>
          Previous
        </button>
        <span>
          Page {page} of {pages}
        </span>
        <button type="button" disabled={page >= pages} onClick={() => load(page + 1).catch((err) => setError(err.message))}>
          Next
        </button>
      </div>
    </div>
  );
}
