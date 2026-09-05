"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";

type Option = { _id: string; name: string; classId?: string };
type StudentRow = { _id: string; name: string; admissionNumber: string };

export function CreateStudentFeesDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => Promise<void> | void;
}) {
  const [classes, setClasses] = useState<Option[]>([]);
  const [sections, setSections] = useState<Option[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("PENDING");
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const classSections = useMemo(
    () => sections.filter((row) => !classId || row.classId === classId),
    [sections, classId],
  );

  useEffect(() => {
    Promise.all([
      api<{ items: Option[] }>("/api/classes"),
      api<{ items: Option[] }>("/api/sections"),
    ])
      .then(([classRes, sectionRes]) => {
        setClasses(classRes.items);
        setSections(sectionRes.items);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load classes."));
  }, []);

  useEffect(() => {
    if (!classId || !sectionId) {
      setStudents([]);
      setSelected([]);
      return;
    }
    setLoadingStudents(true);
    setError("");
    api<{ students: StudentRow[] }>(`/api/fees/class-students?classId=${classId}&sectionId=${sectionId}`)
      .then((data) => {
        setStudents(data.students);
        setSelected(data.students.map((row) => row._id));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load students."))
      .finally(() => setLoadingStudents(false));
  }, [classId, sectionId]);

  const allSelected = students.length > 0 && selected.length === students.length;

  async function save() {
    setError("");
    const value = Number(amount);
    if (!classId || !sectionId) {
      setError("Select class and section.");
      return;
    }
    if (!selected.length) {
      setError("Select at least one student.");
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setSaving(true);
    try {
      await api("/api/fees/create-class", {
        method: "POST",
        body: JSON.stringify({
          classId,
          sectionId,
          studentIds: selected,
          amount: value,
          description,
          dueDate,
          status,
        }),
      });
      await onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create fees.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="gs-card max-h-[92vh] w-full max-w-3xl overflow-y-auto p-6">
        <h2 className="mb-4 text-lg font-semibold gs-heading">Create Student Fees</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            Class Name
            <select
              className="gs-input mt-1"
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setSectionId("");
              }}
            >
              <option value="">Select Class</option>
              {classes.map((row) => (
                <option key={row._id} value={row._id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Section
            <select className="gs-input mt-1" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              <option value="">Select Section</option>
              {classSections.map((row) => (
                <option key={row._id} value={row._id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Amount
            <input className="gs-input mt-1" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="block text-sm">
            Due Date
            <input className="gs-input mt-1" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <label className="block text-sm md:col-span-2">
            Description
            <textarea
              className="gs-input mt-1"
              rows={3}
              placeholder="What this fee is for (for example: Term 1 tuition, activity fee, transport)."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Status
            <select className="gs-input mt-1" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="PENDING">Pending</option>
              <option value="PARTIAL">Partially Paid</option>
              <option value="PAID">Paid</option>
            </select>
          </label>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold gs-heading">Students</h3>
            {students.length ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => setSelected(e.target.checked ? students.map((row) => row._id) : [])}
                />
                Select all
              </label>
            ) : null}
          </div>
          <div className="max-h-64 overflow-y-auto rounded-lg border gs-border">
            {loadingStudents ? <p className="p-3 text-sm gs-muted">Loading students…</p> : null}
            {!loadingStudents && !students.length ? (
              <p className="p-3 text-sm gs-muted">
                {classId && sectionId ? "No students found in this class and section." : "Select class and section to load students."}
              </p>
            ) : null}
            {students.map((student) => (
              <label key={student._id} className="flex items-center gap-3 border-t border-slate-100 px-3 py-2 text-sm first:border-t-0">
                <input
                  type="checkbox"
                  checked={selected.includes(student._id)}
                  onChange={(e) =>
                    setSelected((current) =>
                      e.target.checked ? [...current, student._id] : current.filter((id) => id !== student._id),
                    )
                  }
                />
                <span className="font-medium">{student.name}</span>
                {student.admissionNumber ? <span className="gs-muted">{student.admissionNumber}</span> : null}
              </label>
            ))}
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="rounded-lg border px-4 py-2 text-sm gs-tab" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="gs-btn px-4 py-2 text-sm" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : `Create Fee${selected.length ? ` for ${selected.length} student(s)` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
