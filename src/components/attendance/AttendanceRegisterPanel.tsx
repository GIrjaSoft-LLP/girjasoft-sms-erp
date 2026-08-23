"use client";

import { useEffect, useMemo, useState } from "react";
import type { RegisterReport } from "@/lib/attendance/register";
import { formatDateLabel } from "@/lib/attendance/filters";
import { api } from "@/lib/client";

function defaultDates() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function statusClass(status: string) {
  if (status === "PRESENT") return "bg-emerald-100 text-emerald-800";
  if (status === "ABSENT") return "bg-red-100 text-red-800";
  if (status === "LATE") return "bg-amber-100 text-amber-800";
  if (status === "LEAVE") return "bg-sky-100 text-sky-800";
  return "bg-slate-100 text-slate-600";
}

export function AttendanceRegisterPanel() {
  const defaults = defaultDates();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [academicSessionId, setAcademicSessionId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [report, setReport] = useState<RegisterReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exportOpen, setExportOpen] = useState(false);

  const scopeOptions = report?.scopeOptions;
  const showScopeFilters = report?.role === "admin" || report?.role === "teacher";

  const sectionOptions = useMemo(() => {
    const rows = scopeOptions?.sections ?? [];
    if (!classId) return rows;
    return rows.filter((row) => row.classId === classId);
  }, [classId, scopeOptions?.sections]);

  const subjectOptions = useMemo(() => {
    const rows = scopeOptions?.subjects ?? [];
    if (!classId) return rows;
    return rows.filter((row) => row.classId === classId);
  }, [classId, scopeOptions?.subjects]);

  function buildParams(format?: string) {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (academicSessionId) params.set("academicSessionId", academicSessionId);
    if (classId) params.set("classId", classId);
    if (sectionId) params.set("sectionId", sectionId);
    if (subjectId) params.set("subjectId", subjectId);
    if (format) params.set("format", format);
    return params;
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await api<RegisterReport>(`/api/attendance/register?${buildParams()}`);
      setReport(data);
      if (!academicSessionId && data.scopeOptions?.academicSessions.length) {
        const current = data.scopeOptions.academicSessions.find((row) => row.isCurrent);
        if (current) setAcademicSessionId(current._id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attendance register");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exportFile(format: "csv" | "xlsx" | "pdf") {
    const url = `/api/attendance/register?${buildParams(format)}`;
    if (format === "pdf") {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = url;
    }
    setExportOpen(false);
  }

  const summary = report?.summary;

  return (
    <div className="space-y-4">
      <div className="gs-card grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
        {showScopeFilters && scopeOptions ? (
          <>
            <label className="text-sm">
              <span className="mb-1 block gs-muted">Academic Session</span>
              <select className="gs-input w-full" value={academicSessionId} onChange={(e) => setAcademicSessionId(e.target.value)}>
                <option value="">All Sessions</option>
                {scopeOptions.academicSessions.map((row) => (
                  <option key={row._id} value={row._id}>
                    {row.name}
                    {row.isCurrent ? " (Current)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block gs-muted">Class</span>
              <select
                className="gs-input w-full"
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setSectionId("");
                  setSubjectId("");
                }}
              >
                <option value="">All Classes</option>
                {scopeOptions.classes.map((row) => (
                  <option key={row._id} value={row._id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block gs-muted">Section</span>
              <select className="gs-input w-full" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
                <option value="">All Sections</option>
                {sectionOptions.map((row) => (
                  <option key={row._id} value={row._id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block gs-muted">Subject</span>
              <select className="gs-input w-full" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">All Subjects</option>
                {subjectOptions.map((row) => (
                  <option key={row._id} value={row._id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
        <label className="text-sm">
          <span className="mb-1 block gs-muted">From</span>
          <input className="gs-input w-full" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block gs-muted">To</span>
          <input className="gs-input w-full" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <div className="flex flex-wrap items-end gap-2 md:col-span-2 xl:col-span-4">
          <button type="button" className="gs-btn px-4 py-2 text-sm" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "Filter"}
          </button>
          <div className="relative">
            <button
              type="button"
              className="rounded-lg border px-4 py-2 text-sm gs-tab"
              onClick={() => setExportOpen((open) => !open)}
              disabled={!report?.records.length}
            >
              Export ▾
            </button>
            {exportOpen ? (
              <div className="absolute left-0 z-10 mt-1 w-40 rounded-lg border bg-white py-1 shadow-lg">
                <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => exportFile("csv")}>
                  Export CSV
                </button>
                <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => exportFile("xlsx")}>
                  Export Excel
                </button>
                <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => exportFile("pdf")}>
                  Export PDF
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {report ? (
        <>
          <div className="gs-card p-4 text-sm gs-muted">
            <p className="font-medium gs-heading">Attendance Register</p>
            <p className="mt-1">
              Session: {report.meta.academicSessionName} · Date Range:{" "}
              {report.meta.from && report.meta.to
                ? `${report.meta.from} – ${report.meta.to}`
                : from && to
                  ? `${formatDateLabel(from)} – ${formatDateLabel(to)}`
                  : "—"}
            </p>
            {showScopeFilters ? (
              <p>
                Class: {report.meta.className} · Section: {report.meta.sectionName} · Subject: {report.meta.subjectName}
              </p>
            ) : null}
          </div>

          {summary ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {[
                ["Total Students", summary.totalStudents],
                ["Total Records", summary.totalRecords],
                ["Present", summary.present],
                ["Absent", summary.absent],
                ["Late", summary.late],
                ["Leave", summary.leave],
                ["Attendance %", `${summary.percentage}%`],
              ].map(([label, value]) => (
                <div key={String(label)} className="gs-stat-card">
                  <p className="text-xs gs-muted">{label}</p>
                  <p className="mt-1 text-xl font-semibold gs-heading">{value}</p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="gs-card overflow-x-auto">
            <div className="border-b p-4">
              <h2 className="font-semibold gs-heading">Class-wise Summary</h2>
            </div>
            {report.classSummary.length ? (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left gs-muted">
                    <th className="p-3">Class</th>
                    <th className="p-3">Section</th>
                    <th className="p-3">Students</th>
                    <th className="p-3">Present</th>
                    <th className="p-3">Absent</th>
                    <th className="p-3">Late</th>
                    <th className="p-3">Leave</th>
                    <th className="p-3">Attendance %</th>
                  </tr>
                </thead>
                <tbody>
                  {report.classSummary.map((row) => (
                    <tr key={`${row.classId}-${row.sectionId}`} className="border-b">
                      <td className="p-3">{row.className}</td>
                      <td className="p-3">{row.sectionName}</td>
                      <td className="p-3">{row.students}</td>
                      <td className="p-3">{row.present}</td>
                      <td className="p-3">{row.absent}</td>
                      <td className="p-3">{row.late}</td>
                      <td className="p-3">{row.leave}</td>
                      <td className="p-3">{row.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="p-4 text-sm gs-muted">No class-wise summary for the selected filters.</p>
            )}
          </div>

          <div className="gs-card overflow-x-auto">
            <div className="border-b p-4">
              <h2 className="font-semibold gs-heading">Detailed Attendance</h2>
            </div>
            {report.records.length ? (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left gs-muted">
                    <th className="p-3">Date</th>
                    <th className="p-3">Class</th>
                    <th className="p-3">Section</th>
                    <th className="p-3">Subject</th>
                    <th className="p-3">Student</th>
                    <th className="p-3">Admission No</th>
                    <th className="p-3">Roll No</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Marked By</th>
                  </tr>
                </thead>
                <tbody>
                  {report.records.map((row) => (
                    <tr key={row._id} className="border-b">
                      <td className="p-3">{formatDateLabel(row.date)}</td>
                      <td className="p-3">{row.className}</td>
                      <td className="p-3">{row.sectionName}</td>
                      <td className="p-3">{row.subjectName}</td>
                      <td className="p-3">{row.studentName}</td>
                      <td className="p-3">{row.admissionNumber}</td>
                      <td className="p-3">{row.rollNumber || "—"}</td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass(row.status)}`}>{row.status}</span>
                      </td>
                      <td className="p-3">{row.markedBy || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-4 text-sm gs-muted">
                <p>No attendance records found for the selected filters.</p>
                <p className="mt-1">Try changing the session, class, section, subject, or date range.</p>
              </div>
            )}
          </div>
        </>
      ) : loading ? (
        <p className="text-sm gs-muted">Loading register…</p>
      ) : null}
    </div>
  );
}
