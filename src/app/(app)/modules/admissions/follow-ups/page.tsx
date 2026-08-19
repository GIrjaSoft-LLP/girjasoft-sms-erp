"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FOLLOWUP_STATUSES } from "@/config/admissions";
import { api } from "@/lib/client";

type FollowUp = {
  _id: string;
  followUpDate: string;
  followUpTime: string;
  applicantName: string;
  parentName: string;
  parentMobile: string;
  followUpType: string;
  status: string;
  notes: string;
};

export default function FollowUpsPage() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<FollowUp[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    enquiryId: searchParams.get("enquiryId") ?? "",
    followUpDate: new Date().toISOString().slice(0, 10),
    followUpTime: "",
    applicantName: "",
    parentName: "",
    parentMobile: "",
    followUpType: "CALL",
    notes: "",
    nextFollowUpDate: "",
  });

  async function load() {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const data = await api<{ items: FollowUp[] }>(`/api/admissions/follow-ups${suffix}`);
    setItems(data.items);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    try {
      await api("/api/admissions/follow-ups", { method: "POST", body: JSON.stringify(form) });
      setForm((f) => ({ ...f, notes: "", nextFollowUpDate: "" }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function complete(id: string) {
    await api(`/api/admissions/follow-ups/${id}`, { method: "PATCH", body: JSON.stringify({ status: "COMPLETED" }) });
    await load();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="gs-card p-5 grid md:grid-cols-2 gap-3">
        <h2 className="md:col-span-2 font-semibold">Schedule Follow-up</h2>
        {(["followUpDate", "followUpTime", "applicantName", "parentName", "parentMobile", "followUpType", "nextFollowUpDate"] as const).map((key) => (
          <label key={key} className="text-sm capitalize">
            {key.replace(/([A-Z])/g, " $1")}
            <input className="gs-input mt-1" required={key === "followUpDate"} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
          </label>
        ))}
        <label className="md:col-span-2 text-sm">
          Notes
          <textarea className="gs-input mt-1" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </label>
        <button className="md:col-span-2 gs-btn px-4 py-2 w-fit">Save Follow-up</button>
      </form>

      <div className="flex gap-2 items-end">
        <label className="text-sm">
          Status
          <select className="gs-input mt-1 block" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            {FOLLOWUP_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className="text-red-600">{error}</p> : null}

      <div className="gs-card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Applicant</th>
              <th className="p-3">Parent</th>
              <th className="p-3">Mobile</th>
              <th className="p-3">Type</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row._id} className="border-t border-slate-100">
                <td className="p-3">{row.followUpDate} {row.followUpTime}</td>
                <td className="p-3">{row.applicantName}</td>
                <td className="p-3">{row.parentName}</td>
                <td className="p-3">{row.parentMobile}</td>
                <td className="p-3">{row.followUpType}</td>
                <td className="p-3">{row.status.replace(/_/g, " ")}</td>
                <td className="p-3">
                  {row.status === "PENDING" ? (
                    <button type="button" className="text-[#4c7eff]" onClick={() => complete(row._id).catch((err) => setError(err.message))}>
                      Complete
                    </button>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
