"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ENQUIRY_STATUSES } from "@/config/admissions";
import { api } from "@/lib/client";

type Enquiry = {
  _id: string;
  enquiryNumber: string;
  studentName: string;
  parentName: string;
  parentMobile: string;
  source: string;
  enquiryDate: string;
  status: string;
  followUpDate: string;
};

type Duplicate = { id: string; type: string; label: string; studentName: string; status: string };

const emptyForm = {
  studentName: "",
  dateOfBirth: "",
  gender: "",
  parentName: "",
  parentMobile: "",
  parentEmail: "",
  source: "",
  remarks: "",
  followUpDate: "",
  status: "NEW",
};

export default function EnquiriesPage() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Enquiry[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(searchParams.get("new") === "1");
  const [form, setForm] = useState(emptyForm);
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [saving, setSaving] = useState(false);

  async function load() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const data = await api<{ items: Enquiry[] }>(`/api/admissions/enquiries${suffix}`);
    setItems(data.items);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const filtered = useMemo(() => items, [items]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setDuplicates([]);
    try {
      const data = await api<{ item: Enquiry; duplicates?: Duplicate[] }>("/api/admissions/enquiries", {
        method: "POST",
        body: JSON.stringify(form),
      });
      if (data.duplicates?.length) setDuplicates(data.duplicates);
      setForm(emptyForm);
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function convert(enquiryId: string) {
    if (!confirm("Convert this enquiry to a draft application?")) return;
    try {
      const data = await api<{ item: { _id: string } }>("/api/admissions/enquiries", {
        method: "PUT",
        body: JSON.stringify({ enquiryId }),
      });
      window.location.href = `/modules/admissions/applications/${data.item._id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-sm">
          Search
          <input className="gs-input mt-1 block" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, mobile, enquiry no." />
        </label>
        <label className="text-sm">
          Status
          <select className="gs-input mt-1 block" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            {ENQUIRY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="gs-btn px-4 py-2 text-sm" onClick={() => load().catch((err) => setError(err.message))}>
          Search
        </button>
        <button type="button" className="gs-btn px-4 py-2 text-sm ml-auto" onClick={() => setFormOpen(true)}>
          New Enquiry
        </button>
      </div>

      {formOpen ? (
        <form onSubmit={save} className="gs-card p-5 grid md:grid-cols-2 gap-3">
          <h2 className="md:col-span-2 font-semibold">New Enquiry</h2>
          {(["studentName", "dateOfBirth", "gender", "parentName", "parentMobile", "parentEmail", "source", "followUpDate"] as const).map((key) => (
            <label key={key} className="text-sm capitalize">
              {key.replace(/([A-Z])/g, " $1")}
              <input
                className="gs-input mt-1"
                required={key === "studentName"}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </label>
          ))}
          <label className="md:col-span-2 text-sm">
            Remarks
            <textarea className="gs-input mt-1" rows={2} value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
          </label>
          {duplicates.length ? (
            <div className="md:col-span-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
              <p className="font-medium text-amber-900">Possible existing applicant found</p>
              <ul className="mt-2 space-y-1">
                {duplicates.map((d) => (
                  <li key={`${d.type}-${d.id}`}>
                    {d.type}: {d.label} — {d.studentName} ({d.status})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="md:col-span-2 flex gap-2">
            <button className="gs-btn px-4 py-2" disabled={saving}>
              {saving ? "Saving…" : "Save Enquiry"}
            </button>
            <button type="button" className="px-4 py-2 text-sm" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {error ? <p className="text-red-600">{error}</p> : null}

      <div className="gs-card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-3">Enquiry No.</th>
              <th className="p-3">Student</th>
              <th className="p-3">Parent</th>
              <th className="p-3">Mobile</th>
              <th className="p-3">Source</th>
              <th className="p-3">Date</th>
              <th className="p-3">Follow-up</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row._id} className="border-t border-slate-100">
                <td className="p-3">{row.enquiryNumber}</td>
                <td className="p-3">{row.studentName}</td>
                <td className="p-3">{row.parentName}</td>
                <td className="p-3">{row.parentMobile}</td>
                <td className="p-3">{row.source}</td>
                <td className="p-3">{row.enquiryDate}</td>
                <td className="p-3">{row.followUpDate || "—"}</td>
                <td className="p-3">{row.status.replace(/_/g, " ")}</td>
                <td className="p-3 space-x-2">
                  <button type="button" className="text-[#4c7eff]" onClick={() => convert(row._id)}>
                    To Application
                  </button>
                  <Link href={`/modules/admissions/follow-ups?enquiryId=${row._id}`} className="text-[#4c7eff]">
                    Follow-up
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? <p className="p-4 text-slate-500">No enquiries found.</p> : null}
      </div>
    </div>
  );
}
