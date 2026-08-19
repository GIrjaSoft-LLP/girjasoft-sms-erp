"use client";

import { useEffect, useMemo, useState } from "react";
import { PROMOTION_STATUS_LABELS } from "@/config/promotion";
import { api } from "@/lib/client";

type DashboardData = {
  currentSession: { _id: string; name: string } | null;
  nextSession: { _id: string; name: string } | null;
  stats: {
    totalStudents: number;
    promoted: number;
    pending: number;
    notPromoted: number;
    graduated: number;
    archived: number;
  };
};

type Candidate = {
  _id: string;
  name: string;
  admissionNumber: string;
  classId: string;
  sectionId: string;
  className: string;
  sectionName: string;
  rollNumber: string;
  alreadyPromoted: boolean;
};

type Assignment = {
  studentId: string;
  classId: string;
  sectionId: string;
  rollNumber: string;
  promotionStatus: string;
};

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="gs-card p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#0b1b3a]">{value}</p>
    </div>
  );
}

export default function PromotionPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [classes, setClasses] = useState<Array<{ _id: string; name: string }>>([]);
  const [sections, setSections] = useState<Array<{ _id: string; name: string; classId: string }>>([]);
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [destClassId, setDestClassId] = useState("");
  const [destSectionId, setDestSectionId] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [preview, setPreview] = useState<{ studentCount: number; warnings: string[] } | null>(null);
  const [overrideCapacity, setOverrideCapacity] = useState(false);

  useEffect(() => {
    Promise.all([
      api<DashboardData>("/api/student-info/promotion/dashboard"),
      api<{ items: Array<{ _id: string; name: string }> }>("/api/classes"),
      api<{ items: Array<{ _id: string; name: string; classId: string }> }>("/api/sections"),
    ]).then(([dash, classData, sectionData]) => {
      setDashboard(dash);
      setClasses(classData.items);
      setSections(sectionData.items);
    });
  }, []);

  const sectionOptions = useMemo(
    () => sections.filter((item) => item.classId === classId),
    [classId, sections],
  );
  const destSectionOptions = useMemo(
    () => sections.filter((item) => item.classId === destClassId),
    [destClassId, sections],
  );

  async function loadCandidates() {
    if (!dashboard?.currentSession?._id) return;
    const params = new URLSearchParams({
      academicSessionId: dashboard.currentSession._id,
      targetSessionId: dashboard.nextSession?._id ?? "",
    });
    if (classId) params.set("classId", classId);
    if (sectionId) params.set("sectionId", sectionId);
    const data = await api<{ items: Candidate[] }>(`/api/student-info/promotion/candidates?${params}`);
    setCandidates(data.items.filter((item) => !item.alreadyPromoted));
    setSelected(new Set());
    setAssignments({});
  }

  function toggleAll(checked: boolean) {
    if (checked) setSelected(new Set(candidates.map((item) => item._id)));
    else setSelected(new Set());
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyBulkDestination() {
    if (!destClassId || !destSectionId) {
      setError("Select destination class and section.");
      return;
    }
    const next: Record<string, Assignment> = { ...assignments };
    for (const id of selected) {
      next[id] = {
        studentId: id,
        classId: destClassId,
        sectionId: destSectionId,
        rollNumber: next[id]?.rollNumber ?? "",
        promotionStatus: "PROMOTED",
      };
    }
    setAssignments(next);
    setError("");
  }

  function buildItems() {
    return [...selected].map((studentId) => {
      const fallback = assignments[studentId];
      return (
        fallback ?? {
          studentId,
          classId: destClassId,
          sectionId: destSectionId,
          rollNumber: "",
          promotionStatus: "PROMOTED",
        }
      );
    });
  }

  async function runPromotion(confirm: boolean) {
    if (!dashboard?.currentSession || !dashboard.nextSession) {
      setError("Configure current and next academic sessions first.");
      return;
    }
    const items = buildItems();
    if (!items.length) {
      setError("Select at least one student.");
      return;
    }
    setError("");
    setMessage("");
    const result = await api<{ preview?: { studentCount: number; warnings: string[] }; message?: string }>(
      "/api/student-info/promotion/execute",
      {
        method: "POST",
        body: JSON.stringify({
          fromSessionId: dashboard.currentSession._id,
          toSessionId: dashboard.nextSession._id,
          items,
          overrideCapacity,
          confirm,
        }),
      },
    );
    if (result.preview) {
      setPreview(result.preview);
      setConfirmOpen(true);
      return;
    }
    setMessage(result.message ?? "Promotion completed.");
    setConfirmOpen(false);
    await loadCandidates();
    const dash = await api<DashboardData>("/api/student-info/promotion/dashboard");
    setDashboard(dash);
  }

  return (
    <div className="space-y-6">
      {dashboard ? (
        <>
          <div className="gs-card p-4">
            <h2 className="font-semibold">Academic Year Rollover</h2>
            <p className="mt-1 text-sm text-slate-600">
              {dashboard.currentSession?.name ?? "No current session"} → {dashboard.nextSession?.name ?? "No next session"}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Total Students" value={dashboard.stats.totalStudents} />
            <StatCard label="Promoted" value={dashboard.stats.promoted} />
            <StatCard label="Pending" value={dashboard.stats.pending} />
            <StatCard label="Not Promoted" value={dashboard.stats.notPromoted} />
            <StatCard label="Graduated" value={dashboard.stats.graduated} />
            <StatCard label="Archived" value={dashboard.stats.archived} />
          </div>
        </>
      ) : null}

      <div className="gs-card space-y-4 p-4">
        <h3 className="font-semibold">Filter Students</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Current Class</span>
            <select className="gs-input" value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(""); }}>
              <option value="">All Classes</option>
              {classes.map((item) => (
                <option key={item._id} value={item._id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Current Section</span>
            <select className="gs-input" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              <option value="">All Sections</option>
              {sectionOptions.map((item) => (
                <option key={item._id} value={item._id}>{item.name}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button type="button" className="gs-btn-primary" onClick={loadCandidates}>Load Students</button>
          </div>
        </div>
      </div>

      <div className="gs-card space-y-4 p-4">
        <h3 className="font-semibold">Promote To</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">New Class</span>
            <select className="gs-input" value={destClassId} onChange={(e) => { setDestClassId(e.target.value); setDestSectionId(""); }}>
              <option value="">Select Class</option>
              {classes.map((item) => (
                <option key={item._id} value={item._id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">New Section</span>
            <select className="gs-input" value={destSectionId} onChange={(e) => setDestSectionId(e.target.value)}>
              <option value="">Select Section</option>
              {destSectionOptions.map((item) => (
                <option key={item._id} value={item._id}>{item.name}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button type="button" className="gs-btn-secondary" onClick={applyBulkDestination}>Apply to Selected</button>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={overrideCapacity} onChange={(e) => setOverrideCapacity(e.target.checked)} />
          Override section capacity (Admin)
        </label>
      </div>

      <div className="gs-card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="p-3">
                <input type="checkbox" checked={selected.size > 0 && selected.size === candidates.length} onChange={(e) => toggleAll(e.target.checked)} />
              </th>
              <th className="p-3">Student</th>
              <th className="p-3">Admission No.</th>
              <th className="p-3">Current</th>
              <th className="p-3">New Section</th>
              <th className="p-3">Roll No.</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((row) => {
              const assignment = assignments[row._id];
              return (
                <tr key={row._id} className="border-b">
                  <td className="p-3">
                    <input type="checkbox" checked={selected.has(row._id)} onChange={() => toggleOne(row._id)} />
                  </td>
                  <td className="p-3">{row.name}</td>
                  <td className="p-3">{row.admissionNumber}</td>
                  <td className="p-3">{row.className}-{row.sectionName}</td>
                  <td className="p-3">
                    <select
                      className="gs-input"
                      value={assignment?.sectionId ?? destSectionId}
                      onChange={(e) =>
                        setAssignments((prev) => ({
                          ...prev,
                          [row._id]: {
                            studentId: row._id,
                            classId: destClassId,
                            sectionId: e.target.value,
                            rollNumber: prev[row._id]?.rollNumber ?? "",
                            promotionStatus: prev[row._id]?.promotionStatus ?? "PROMOTED",
                          },
                        }))
                      }
                    >
                      <option value="">—</option>
                      {destSectionOptions.map((item) => (
                        <option key={item._id} value={item._id}>{item.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <input
                      className="gs-input w-20"
                      value={assignment?.rollNumber ?? ""}
                      onChange={(e) =>
                        setAssignments((prev) => ({
                          ...prev,
                          [row._id]: {
                            studentId: row._id,
                            classId: destClassId,
                            sectionId: prev[row._id]?.sectionId ?? destSectionId,
                            rollNumber: e.target.value,
                            promotionStatus: prev[row._id]?.promotionStatus ?? "PROMOTED",
                          },
                        }))
                      }
                    />
                  </td>
                  <td className="p-3">
                    <select
                      className="gs-input"
                      value={assignment?.promotionStatus ?? "PROMOTED"}
                      onChange={(e) =>
                        setAssignments((prev) => ({
                          ...prev,
                          [row._id]: {
                            studentId: row._id,
                            classId: destClassId,
                            sectionId: prev[row._id]?.sectionId ?? destSectionId,
                            rollNumber: prev[row._id]?.rollNumber ?? "",
                            promotionStatus: e.target.value,
                          },
                        }))
                      }
                    >
                      {Object.entries(PROMOTION_STATUS_LABELS).map(([value, label]) =>
                        ["PROMOTED", "NOT_PROMOTED", "GRADUATED", "TRANSFERRED"].includes(value) ? (
                          <option key={value} value={value}>{label}</option>
                        ) : null,
                      )}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" className="gs-btn-primary" onClick={() => runPromotion(false)}>
          Review Promotion ({selected.size})
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      {confirmOpen && preview ? (
        <div className="gs-card space-y-3 p-4">
          <h3 className="font-semibold">Confirm Promotion</h3>
          <p className="text-sm text-slate-600">{preview.studentCount} student(s) will be processed.</p>
          {preview.warnings.length ? (
            <ul className="list-disc pl-5 text-sm text-amber-700">
              {preview.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          <div className="flex gap-2">
            <button type="button" className="gs-btn-secondary" onClick={() => setConfirmOpen(false)}>Cancel</button>
            <button type="button" className="gs-btn-primary" onClick={() => runPromotion(true)}>Confirm Promotion</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
