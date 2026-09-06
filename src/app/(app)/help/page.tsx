"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RecordDialog } from "@/components/RecordDialog";
import { ticketLabel } from "@/config/tickets";
import { api } from "@/lib/client";

type TicketRow = {
  _id: string;
  ticketNumber: string;
  type: string;
  subject: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export default function HelpPage() {
  const [items, setItems] = useState<TicketRow[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [counts, setCounts] = useState({ open: 0, inProgress: 0, resolved: 0, closed: 0 });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    type: "INCIDENT",
    subject: "",
    description: "",
    priority: "MEDIUM",
    module: "Other",
    page: "",
  });

  async function load() {
    const data = await api<{ items: TicketRow[]; counts: typeof counts; modules: string[] }>("/api/help/tickets");
    setItems(data.items);
    setCounts(data.counts);
    setModules(data.modules);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.append(key, value));
      if (file) body.append("file", file);
      const response = await fetch("/api/help/tickets", { method: "POST", body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((data as { error?: string }).error || "Could not create ticket");
      setOpen(false);
      setFile(null);
      setForm({ type: "INCIDENT", subject: "", description: "", priority: "MEDIUM", module: "Other", page: "" });
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create ticket");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#0b1b3a]">Help & Support</h1>
          <p className="text-sm text-slate-500">How can we help? Report an incident or request assistance.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/guide" className="gs-btn border border-slate-200 bg-white px-4 py-2 text-[#0b1b3a]">
            Guide
          </Link>
          <button type="button" className="gs-btn px-4 py-2" onClick={() => setOpen(true)}>
            Create Support Request
          </button>
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Open", counts.open],
          ["In Progress", counts.inProgress],
          ["Resolved", counts.resolved],
          ["Closed", counts.closed],
        ].map(([label, value]) => (
          <div key={String(label)} className="gs-card p-4">
            <div className="text-sm text-slate-500">{label}</div>
            <div className="text-2xl font-semibold">{value}</div>
          </div>
        ))}
      </div>
      <div className="gs-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              {["Ticket ID", "Subject", "Type", "Priority", "Status", "Created", "Updated"].map((col) => (
                <th key={col} className="p-3 font-medium">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item._id} className="border-t border-slate-100">
                <td className="p-3">
                  <Link href={`/help/${item._id}`} className="font-medium text-[#4c7eff]">
                    {item.ticketNumber}
                  </Link>
                </td>
                <td className="p-3">{item.subject}</td>
                <td className="p-3">{ticketLabel(item.type)}</td>
                <td className="p-3">{ticketLabel(item.priority)}</td>
                <td className="p-3">{ticketLabel(item.status)}</td>
                <td className="p-3">{new Date(item.createdAt).toLocaleDateString()}</td>
                <td className="p-3">{new Date(item.updatedAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td className="p-6 text-slate-500" colSpan={7}>
                  <p className="font-medium text-[#0b1b3a]">No support tickets found.</p>
                  <p className="mt-1">
                    If you are facing an issue or need assistance, create a support request and our team will help you.
                  </p>
                  <button type="button" className="gs-btn mt-3 px-4 py-2" onClick={() => setOpen(true)}>
                    Create Support Request
                  </button>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {open ? (
        <RecordDialog title="Create Support Request" onClose={() => setOpen(false)}>
          <form onSubmit={create} className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Ticket type</span>
              <select className="gs-input" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                <option value="INCIDENT">Incident</option>
                <option value="REQUEST">Request</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Priority</span>
              <select className="gs-input" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </label>
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block text-slate-600">Subject</span>
              <input className="gs-input" required value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Module</span>
              <select className="gs-input" value={form.module} onChange={(e) => setForm((f) => ({ ...f, module: e.target.value }))}>
                {modules.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Page / section</span>
              <input className="gs-input" value={form.page} onChange={(e) => setForm((f) => ({ ...f, page: e.target.value }))} />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block text-slate-600">Description</span>
              <textarea
                className="gs-input min-h-28"
                required
                placeholder="Please describe the issue/request in detail..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block text-slate-600">Attachment</span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <p className="mt-1 text-xs text-slate-500">
                  {file.name} ({Math.round(file.size / 1024)} KB){" "}
                  <button type="button" className="text-red-600" onClick={() => setFile(null)}>
                    Remove
                  </button>
                </p>
              ) : null}
            </label>
            {formError ? <p className="text-sm text-red-600 md:col-span-2">{formError}</p> : null}
            <div className="md:col-span-2 flex justify-end gap-2">
              <button type="button" className="px-3 py-2 text-sm" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="gs-btn px-4 py-2" disabled={saving}>
                {saving ? "Submitting…" : "Submit ticket"}
              </button>
            </div>
          </form>
        </RecordDialog>
      ) : null}
    </div>
  );
}
