"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";

type LeaveContext = {
  mode: "admin" | "teacher";
  canApply: boolean;
  canManageConfig: boolean;
  canReview: boolean;
  canDeleteConfig: boolean;
};

type LeaveTypeRow = { _id: string; name: string; code: string; days: number };
type HolidayRow = { _id: string; name: string; date: string };
type RequestRow = {
  _id: string;
  requesterName: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: string;
};
type BalanceRow = {
  leaveTypeId: string;
  name: string;
  code: string;
  entitled: number;
  used: number;
  remaining: number;
};

type Tab = "requests" | "types" | "holidays";

function formatDate(value?: string) {
  if (!value) return "—";
  const isoDay = value.slice(0, 10);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(isoDay) ? new Date(`${isoDay}T00:00:00`) : new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function statusLabel(status: string) {
  if (status === "PENDING") return "Pending";
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  return status;
}

export function LeavePanel({ embedded = false }: { embedded?: boolean }) {
  const [context, setContext] = useState<LeaveContext | null>(null);
  const [tab, setTab] = useState<Tab>("requests");
  const [types, setTypes] = useState<LeaveTypeRow[]>([]);
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const [typeForm, setTypeForm] = useState({ name: "", code: "", days: "12" });
  const [holidayForm, setHolidayForm] = useState({ name: "", date: "" });
  const [applyForm, setApplyForm] = useState({ leaveTypeId: "", fromDate: "", toDate: "", reason: "" });

  const isTeacher = context?.mode === "teacher";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const portal = await api<LeaveContext>("/api/leave/context");
      setContext(portal);
      const [typeData, holidayData, requestData] = await Promise.all([
        api<{ items: LeaveTypeRow[] }>("/api/leave/types"),
        api<{ items: HolidayRow[] }>("/api/leave/holidays"),
        api<{ items: RequestRow[] }>("/api/leave/requests"),
      ]);
      setTypes(typeData.items);
      setHolidays(holidayData.items);
      setRequests(requestData.items);
      if (portal.mode === "teacher") {
        const balanceData = await api<{ items: BalanceRow[] }>("/api/leave/balances");
        setBalances(balanceData.items);
        setTab("requests");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load leave.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveType() {
    setBusy(true);
    setFormError("");
    try {
      if (!typeForm.name.trim()) throw new Error("Leave type name is required.");
      await api("/api/leave/types", {
        method: "POST",
        body: JSON.stringify({
          name: typeForm.name.trim(),
          code: typeForm.code.trim().toUpperCase(),
          days: Number(typeForm.days || 0),
        }),
      });
      setTypeForm({ name: "", code: "", days: "12" });
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save leave type.");
    } finally {
      setBusy(false);
    }
  }

  async function removeType(id: string) {
    if (!window.confirm("Delete this leave type?")) return;
    try {
      await api(`/api/leave/types/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete leave type.");
    }
  }

  async function saveHoliday() {
    setBusy(true);
    setFormError("");
    try {
      if (!holidayForm.name.trim() || !holidayForm.date) throw new Error("Holiday name and date are required.");
      await api("/api/leave/holidays", {
        method: "POST",
        body: JSON.stringify({ name: holidayForm.name.trim(), date: holidayForm.date }),
      });
      setHolidayForm({ name: "", date: "" });
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save holiday.");
    } finally {
      setBusy(false);
    }
  }

  async function removeHoliday(id: string) {
    if (!window.confirm("Delete this public holiday?")) return;
    try {
      await api(`/api/leave/holidays/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete holiday.");
    }
  }

  async function applyLeave() {
    setBusy(true);
    setFormError("");
    try {
      if (!applyForm.leaveTypeId) throw new Error("Select a leave type.");
      if (!applyForm.fromDate || !applyForm.toDate) throw new Error("From and to dates are required.");
      await api("/api/leave/apply", { method: "POST", body: JSON.stringify(applyForm) });
      setApplyForm({ leaveTypeId: "", fromDate: "", toDate: "", reason: "" });
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not apply leave.");
    } finally {
      setBusy(false);
    }
  }

  async function review(id: string, status: "APPROVED" | "REJECTED") {
    try {
      await api(`/api/leave/${id}/review`, { method: "PATCH", body: JSON.stringify({ status }) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update leave request.");
    }
  }

  const title = isTeacher ? "My Leave" : "Leave";
  const subtitle = isTeacher
    ? "Apply for leave and track your remaining Casual Leave (CL) and Sick Leave (SL) days."
    : "Create leave types and yearly entitlements, publish public holidays, and review teacher leave requests.";

  return (
    <div className="space-y-6">
      {!embedded ? (
        <div>
          <h1 className="text-2xl font-semibold gs-heading">{title}</h1>
          <p className="text-sm gs-muted">{subtitle}</p>
        </div>
      ) : (
        <p className="text-sm gs-muted">{subtitle}</p>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!isTeacher ? (
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["requests", "Requests"],
              ["types", "Leave Types"],
              ["holidays", "Public Holidays"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`rounded-full px-4 py-1.5 text-sm ${tab === key ? "gs-btn" : "border gs-border"}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? <p className="text-sm text-slate-500">Loading leave…</p> : null}

      {isTeacher && !loading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="gs-card p-5 space-y-4">
            <h2 className="font-semibold gs-heading">Apply Leave</h2>
            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
            <label className="block text-sm">
              Leave Type
              <select
                className="gs-input mt-1"
                value={applyForm.leaveTypeId}
                onChange={(e) => setApplyForm((prev) => ({ ...prev, leaveTypeId: e.target.value }))}
              >
                <option value="">Select type</option>
                {types.map((type) => (
                  <option key={type._id} value={type._id}>
                    {type.name}
                    {type.code ? ` (${type.code})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                From
                <input
                  type="date"
                  className="gs-input mt-1"
                  value={applyForm.fromDate}
                  onChange={(e) => setApplyForm((prev) => ({ ...prev, fromDate: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                To
                <input
                  type="date"
                  className="gs-input mt-1"
                  value={applyForm.toDate}
                  onChange={(e) => setApplyForm((prev) => ({ ...prev, toDate: e.target.value }))}
                />
              </label>
            </div>
            <label className="block text-sm">
              Reason
              <textarea
                className="gs-input mt-1"
                rows={3}
                value={applyForm.reason}
                onChange={(e) => setApplyForm((prev) => ({ ...prev, reason: e.target.value }))}
              />
            </label>
            {context?.canApply ? (
              <button type="button" className="gs-btn px-4 py-2" disabled={busy} onClick={() => void applyLeave()}>
                {busy ? "Submitting…" : "Submit Request"}
              </button>
            ) : (
              <p className="text-sm text-slate-500">You do not have permission to apply leave.</p>
            )}
          </div>
          <div className="space-y-6">
            <div className="gs-card overflow-x-auto">
              <h2 className="p-4 font-semibold gs-heading">Balance this year</h2>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="p-3 font-medium">Type</th>
                    <th className="p-3 font-medium">Entitled</th>
                    <th className="p-3 font-medium">Used</th>
                    <th className="p-3 font-medium">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.length ? (
                    balances.map((row) => (
                      <tr key={row.leaveTypeId} className="border-t border-slate-100">
                        <td className="p-3">
                          {row.name}
                          {row.code ? ` (${row.code})` : ""}
                        </td>
                        <td className="p-3">{row.entitled}</td>
                        <td className="p-3">{row.used}</td>
                        <td className="p-3">{row.remaining}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-4 text-slate-500">
                        No leave types configured yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="gs-card overflow-x-auto">
              <h2 className="p-4 font-semibold gs-heading">Public Holidays</h2>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="p-3 font-medium">Holiday</th>
                    <th className="p-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.length ? (
                    holidays.map((row) => (
                      <tr key={row._id} className="border-t border-slate-100">
                        <td className="p-3">{row.name}</td>
                        <td className="p-3">{formatDate(row.date)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="p-4 text-slate-500">
                        No public holidays listed.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && (isTeacher || tab === "requests") ? (
        <div className="gs-card overflow-x-auto">
          <h2 className="p-4 font-semibold gs-heading">{isTeacher ? "My Requests" : "Leave Requests"}</h2>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                {!isTeacher ? <th className="p-3 font-medium">Teacher</th> : null}
                <th className="p-3 font-medium">Type</th>
                <th className="p-3 font-medium">From</th>
                <th className="p-3 font-medium">To</th>
                <th className="p-3 font-medium">Reason</th>
                <th className="p-3 font-medium">Status</th>
                {context?.canReview ? <th className="p-3 font-medium">Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {requests.length ? (
                requests.map((row) => (
                  <tr key={row._id} className="border-t border-slate-100">
                    {!isTeacher ? <td className="p-3">{row.requesterName}</td> : null}
                    <td className="p-3">
                      {row.leaveTypeName}
                      {row.leaveTypeCode ? ` (${row.leaveTypeCode})` : ""}
                    </td>
                    <td className="p-3">{formatDate(row.fromDate)}</td>
                    <td className="p-3">{formatDate(row.toDate)}</td>
                    <td className="p-3">{row.reason || "—"}</td>
                    <td className="p-3">{statusLabel(row.status)}</td>
                    {context?.canReview ? (
                      <td className="p-3 space-x-3">
                        {row.status === "PENDING" ? (
                          <>
                            <button type="button" className="text-[#4c7eff] hover:underline" onClick={() => void review(row._id, "APPROVED")}>
                              Approve
                            </button>
                            <button type="button" className="text-red-600 hover:underline" onClick={() => void review(row._id, "REJECTED")}>
                              Reject
                            </button>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isTeacher ? 5 : 7} className="p-4 text-slate-500">
                    No leave requests yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {!isTeacher && !loading && tab === "types" ? (
        <div className="space-y-4">
          {context?.canManageConfig ? (
            <div className="gs-card p-5 grid gap-3 md:grid-cols-4">
              {formError && tab === "types" ? <p className="text-sm text-red-600 md:col-span-4">{formError}</p> : null}
              <label className="block text-sm">
                Name
                <input className="gs-input mt-1" value={typeForm.name} onChange={(e) => setTypeForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Casual Leave" />
              </label>
              <label className="block text-sm">
                Code
                <input className="gs-input mt-1" value={typeForm.code} onChange={(e) => setTypeForm((prev) => ({ ...prev, code: e.target.value }))} placeholder="CL" />
              </label>
              <label className="block text-sm">
                Days / Year
                <input type="number" min={0} className="gs-input mt-1" value={typeForm.days} onChange={(e) => setTypeForm((prev) => ({ ...prev, days: e.target.value }))} />
              </label>
              <div className="flex items-end">
                <button type="button" className="gs-btn px-4 py-2" disabled={busy} onClick={() => void saveType()}>
                  Add Leave Type
                </button>
              </div>
            </div>
          ) : null}
          <div className="gs-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="p-3 font-medium">Type</th>
                  <th className="p-3 font-medium">Code</th>
                  <th className="p-3 font-medium">Days / Year</th>
                  {context?.canDeleteConfig ? <th className="p-3 font-medium">Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {types.map((row) => (
                  <tr key={row._id} className="border-t border-slate-100">
                    <td className="p-3">{row.name}</td>
                    <td className="p-3">{row.code || "—"}</td>
                    <td className="p-3">{row.days}</td>
                    {context?.canDeleteConfig ? (
                      <td className="p-3">
                        <button type="button" className="text-red-600 hover:underline" onClick={() => void removeType(row._id)}>
                          Delete
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {!isTeacher && !loading && tab === "holidays" ? (
        <div className="space-y-4">
          {context?.canManageConfig ? (
            <div className="gs-card p-5 grid gap-3 md:grid-cols-3">
              {formError && tab === "holidays" ? <p className="text-sm text-red-600 md:col-span-3">{formError}</p> : null}
              <label className="block text-sm">
                Holiday
                <input className="gs-input mt-1" value={holidayForm.name} onChange={(e) => setHolidayForm((prev) => ({ ...prev, name: e.target.value }))} />
              </label>
              <label className="block text-sm">
                Date
                <input type="date" className="gs-input mt-1" value={holidayForm.date} onChange={(e) => setHolidayForm((prev) => ({ ...prev, date: e.target.value }))} />
              </label>
              <div className="flex items-end">
                <button type="button" className="gs-btn px-4 py-2" disabled={busy} onClick={() => void saveHoliday()}>
                  Add Holiday
                </button>
              </div>
            </div>
          ) : null}
          <div className="gs-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="p-3 font-medium">Holiday</th>
                  <th className="p-3 font-medium">Date</th>
                  {context?.canDeleteConfig ? <th className="p-3 font-medium">Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {holidays.map((row) => (
                  <tr key={row._id} className="border-t border-slate-100">
                    <td className="p-3">{row.name}</td>
                    <td className="p-3">{formatDate(row.date)}</td>
                    {context?.canDeleteConfig ? (
                      <td className="p-3">
                        <button type="button" className="text-red-600 hover:underline" onClick={() => void removeHoliday(row._id)}>
                          Delete
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
