"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";

type TeacherRow = { _id: string; name: string; employeeId: string; email: string; status: string };
type ClassRow = { _id: string; name: string };
type ClassGroup = {
  classId: string;
  className: string;
  sections: Array<{ sectionId: string; name: string }>;
  subjects: Array<{ subjectId: string; name: string }>;
  teachers?: Array<{ teacherId: string; name: string; employeeId?: string }>;
};

type AdminView = {
  teacher: TeacherRow;
  assignedClassIds: string[];
  assignedClasses: ClassGroup[];
  allClasses: ClassRow[];
};

export function TeacherAssignmentsManager() {
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [view, setView] = useState<AdminView | null>(null);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [removeTarget, setRemoveTarget] = useState<{ classId: string; className: string } | null>(null);

  useEffect(() => {
    api<{ teachers: TeacherRow[] }>("/api/teacher-assignments")
      .then((data) => setTeachers(data.teachers))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load teachers"));
  }, []);

  const filteredTeachers = useMemo(() => {
    const q = teacherSearch.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.employeeId.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q),
    );
  }, [teacherSearch, teachers]);

  const loadTeacher = useCallback(async (id: string) => {
    if (!id) {
      setView(null);
      setSelectedClassIds([]);
      setPreview([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await api<AdminView>(`/api/teacher-assignments?teacherId=${encodeURIComponent(id)}`);
      setView(data);
      setSelectedClassIds(data.assignedClassIds);
      setPreview(data.assignedClasses);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assignments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTeacher(teacherId);
  }, [teacherId, loadTeacher]);

  useEffect(() => {
    if (!teacherId || !selectedClassIds.length) {
      setPreview(view?.assignedClasses ?? []);
      return;
    }
    const timer = window.setTimeout(() => {
      api<{ preview: ClassGroup[] }>(
        `/api/teacher-assignments?classIds=${selectedClassIds.map(encodeURIComponent).join(",")}`,
      )
        .then((data) => setPreview(data.preview))
        .catch(() => undefined);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [selectedClassIds, teacherId, view?.assignedClasses]);

  function toggleClass(classId: string) {
    setSelectedClassIds((current) =>
      current.includes(classId) ? current.filter((id) => id !== classId) : [...current, classId],
    );
    setMessage("");
  }

  async function saveAssignments() {
    if (!teacherId) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const data = await api<AdminView>("/api/teacher-assignments", {
        method: "PUT",
        body: JSON.stringify({ teacherId, classIds: selectedClassIds }),
      });
      setView(data);
      setSelectedClassIds(data.assignedClassIds);
      setPreview(data.assignedClasses);
      setMessage("Teacher assignments saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function confirmRemove(classId: string, className: string) {
    setRemoveTarget({ classId, className });
  }

  function applyRemove() {
    if (!removeTarget) return;
    setSelectedClassIds((current) => current.filter((id) => id !== removeTarget.classId));
    setRemoveTarget(null);
    setMessage("");
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-xl font-semibold">Teacher Assignment</h2>
        <p className="mt-1 text-sm text-slate-500">
          Assign classes to teachers. All sections and subjects under each class are included automatically.
        </p>
      </div>

      <div className="gs-card p-5 space-y-4">
        <h3 className="font-semibold">Select Teacher</h3>
        <label className="block text-sm">
          Search teacher
          <input
            className="gs-input mt-1"
            placeholder="Search by name, employee ID or email"
            value={teacherSearch}
            onChange={(e) => setTeacherSearch(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Teacher
          <select
            className="gs-input mt-1"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
          >
            <option value="">Select a teacher…</option>
            {filteredTeachers.map((row) => (
              <option key={row._id} value={row._id}>
                {row.name} ({row.employeeId})
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? <p className="text-sm text-slate-500">Loading assignments…</p> : null}

      {view ? (
        <>
          <div className="gs-card p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">Assign Classes</h3>
                <p className="text-sm text-slate-500">
                  {view.teacher.name} · {view.teacher.employeeId}
                </p>
              </div>
              <button
                type="button"
                className="gs-btn px-4 py-2 text-sm disabled:opacity-60"
                disabled={saving}
                onClick={() => void saveAssignments()}
              >
                {saving ? "Saving…" : "Save Assignment"}
              </button>
            </div>

            {view.allClasses.length ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {view.allClasses.map((row) => (
                  <label
                    key={row._id}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedClassIds.includes(row._id)}
                      onChange={() => toggleClass(row._id)}
                    />
                    {row.name}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No active classes found in this workspace.</p>
            )}
          </div>

          <div className="gs-card p-5 space-y-4">
            <h3 className="font-semibold">Assigned Classes</h3>
            {selectedClassIds.length ? (
              <div className="space-y-2">
                {view.allClasses
                  .filter((row) => selectedClassIds.includes(row._id))
                  .map((row) => (
                    <div
                      key={row._id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{row.name}</span>
                      <button
                        type="button"
                        className="text-red-600 hover:underline"
                        onClick={() => confirmRemove(row._id, row.name)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No classes assigned yet.</p>
            )}
          </div>

          <div className="gs-card p-5 space-y-4">
            <h3 className="font-semibold">Assignment Summary</h3>
            {preview.length ? (
              <div className="space-y-4">
                {preview.map((group) => (
                  <div key={group.classId} className="rounded-lg border border-slate-200 p-4">
                    <p className="font-semibold text-[#0b1b3a]">{group.className}</p>
                    <div className="mt-3 grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Sections</p>
                        <ul className="mt-2 space-y-1 text-sm">
                          {group.sections.length ? (
                            group.sections.map((section) => (
                              <li key={section.sectionId}>✓ {section.name}</li>
                            ))
                          ) : (
                            <li className="text-slate-500">No sections configured</li>
                          )}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Subjects</p>
                        <ul className="mt-2 space-y-1 text-sm">
                          {group.subjects.length ? (
                            group.subjects.map((subject) => (
                              <li key={subject.subjectId}>✓ {subject.name}</li>
                            ))
                          ) : (
                            <li className="text-slate-500">No subjects configured</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Select classes to preview sections and subjects.</p>
            )}
          </div>
        </>
      ) : teacherId ? null : (
        <div className="gs-card p-5 text-sm text-slate-500">Select a teacher to manage class assignments.</div>
      )}

      {error ? <p className="text-red-600">{error}</p> : null}
      {message ? <p className="text-emerald-700">{message}</p> : null}

      {removeTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="gs-card w-full max-w-md p-5 space-y-4">
            <h3 className="font-semibold">Remove class assignment?</h3>
            <p className="text-sm text-slate-600">
              Remove <strong>{removeTarget.className}</strong> from {view?.teacher.name}? Section and subject access
              for this class will be removed for this teacher only.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="gs-btn px-4 py-2 text-sm" onClick={() => setRemoveTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="gs-btn px-4 py-2 text-sm bg-red-600 text-white"
                onClick={applyRemove}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
