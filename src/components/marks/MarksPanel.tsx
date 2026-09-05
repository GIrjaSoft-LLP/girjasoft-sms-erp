"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { BulkMarksUpload } from "@/components/marks/BulkMarksUpload";
import { GradeCriteriaEditor } from "@/components/marks/GradeCriteriaEditor";

type Option = { _id: string; name: string; classId?: string; sectionId?: string };
type GradeBand = { min: number; max: number; rating: string };
type ModuleContext = {
  mode: "admin" | "teacher" | "parent" | "student";
  canCreate: boolean;
  canEdit: boolean;
  canConfigureCriteria: boolean;
  gradeCriteria?: GradeBand[];
};
type FilterOptions = {
  exams: Option[];
  classes: Option[];
  sections: Option[];
  students: Option[];
  subjects: Option[];
};
type Summary = {
  examId: string;
  studentId: string;
  examName: string;
  studentName: string;
  className: string;
  sectionName: string;
  totalMarks: number;
  gainedMarks: number;
  percentage: number;
  rating: string;
};
type ParentExam = {
  examId: string;
  examName: string;
  hasMarks: boolean;
  totalMarks: number;
  gainedMarks: number;
  percentage: number;
  rating: string;
};
type ResultView = {
  examName: string;
  studentName: string;
  className: string;
  sectionName: string;
  rows: Array<{ subjectName: string; maxMarks: number; marksObtained: number; percentage: number }>;
  totalMarks: number;
  gainedMarks: number;
  percentage: number;
  rating: string;
};
type StudentEntry = {
  examName: string;
  className: string;
  sectionName: string;
  studentName: string;
  rows: Array<{ subjectId: string; subjectName: string; maxMarks: number; marksObtained: number | "" }>;
};
type ClassEntry = {
  examName: string;
  className: string;
  sectionName: string;
  subjectName: string;
  maxMarks: number;
  rows: Array<{ studentId: string; studentName: string; marksObtained: number | "" }>;
};

function pct(value: number) {
  return `${value.toFixed(2)}%`;
}

function ratingFor(percentage: number, bands: GradeBand[] | undefined) {
  const match = (bands ?? []).find((row) => percentage >= row.min && percentage <= row.max);
  return match?.rating ?? "";
}

function ResultModal({
  item,
  loading,
  error,
  onClose,
}: {
  item: ResultView | null;
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="gs-card flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold gs-heading">Exam Result</h2>
          <button type="button" className="rounded-lg border px-3 py-1.5 text-sm gs-tab" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto text-sm">
          {loading ? <p className="gs-muted">Loading result…</p> : null}
          {error ? <p className="text-red-600">{error}</p> : null}
          {!loading && item ? (
            <div className="space-y-4">
              <div className="grid gap-2 md:grid-cols-2">
                <p><span className="gs-muted">Student Name: </span>{item.studentName}</p>
                <p><span className="gs-muted">Exam: </span>{item.examName}</p>
                <p><span className="gs-muted">Class: </span>{item.className}</p>
                <p><span className="gs-muted">Section: </span>{item.sectionName}</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="p-3 font-medium">Subject</th>
                    <th className="p-3 font-medium">Total Marks</th>
                    <th className="p-3 font-medium">Gained Marks</th>
                    <th className="p-3 font-medium">Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {item.rows.map((row) => (
                    <tr key={row.subjectName} className="border-t border-slate-100">
                      <td className="p-3">{row.subjectName}</td>
                      <td className="p-3">{row.maxMarks}</td>
                      <td className="p-3">{row.marksObtained}</td>
                      <td className="p-3">{pct(row.percentage)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="rounded-lg border gs-border bg-slate-50 p-3">
                <p>Total Marks: <strong>{item.totalMarks}</strong></p>
                <p>Gained Marks: <strong>{item.gainedMarks}</strong></p>
                <p>Overall Percentage: <strong>{pct(item.percentage)}</strong></p>
                <p>Rating: <strong>{item.rating || "—"}</strong></p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function MarksPanel() {
  const [tab, setTab] = useState<"results" | "criteria">("results");
  const [ctx, setCtx] = useState<ModuleContext | null>(null);
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [items, setItems] = useState<Summary[]>([]);
  const [parentExams, setParentExams] = useState<ParentExam[]>([]);
  const [parentMeta, setParentMeta] = useState({ studentName: "", className: "", sectionName: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState({ examId: "", classId: "", sectionId: "", studentId: "", subjectId: "" });
  const [bulkOpen, setBulkOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<"student" | "class">("student");
  const [entry, setEntry] = useState({ examId: "", classId: "", sectionId: "", studentId: "", subjectId: "" });
  const [studentEntry, setStudentEntry] = useState<StudentEntry | null>(null);
  const [classEntry, setClassEntry] = useState<ClassEntry | null>(null);
  const [entryError, setEntryError] = useState("");
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<ResultView | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState("");
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedParentExam, setSelectedParentExam] = useState<ParentExam | null>(null);

  const isParent = ctx?.mode === "parent" || ctx?.mode === "student";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const contextRes = await api<{ moduleContext: ModuleContext; filterOptions: FilterOptions }>("/api/marks/context");
      setCtx(contextRes.moduleContext);
      setOptions(contextRes.filterOptions);
      if (contextRes.moduleContext.mode === "parent" || contextRes.moduleContext.mode === "student") {
        const parent = await api<{
          studentName: string;
          className: string;
          sectionName: string;
          exams: ParentExam[];
        }>("/api/marks/parent-exams");
        setParentMeta({
          studentName: parent.studentName,
          className: parent.className,
          sectionName: parent.sectionName,
        });
        setParentExams(parent.exams);
      } else {
        const list = await api<{ items: Summary[] }>("/api/marks/summaries");
        setItems(list.items);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load marks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sections = useMemo(
    () => (options ? options.sections.filter((row) => !filters.classId || row.classId === filters.classId) : []),
    [options, filters.classId],
  );
  const students = useMemo(
    () =>
      options
        ? options.students.filter(
            (row) =>
              (!filters.classId || row.classId === filters.classId) &&
              (!filters.sectionId || row.sectionId === filters.sectionId),
          )
        : [],
    [options, filters.classId, filters.sectionId],
  );
  const subjects = useMemo(
    () => (options ? options.subjects.filter((row) => !filters.classId || row.classId === filters.classId) : []),
    [options, filters.classId],
  );
  const entrySections = useMemo(
    () => (options ? options.sections.filter((row) => !entry.classId || row.classId === entry.classId) : []),
    [options, entry.classId],
  );
  const entryStudents = useMemo(
    () =>
      options
        ? options.students.filter(
            (row) =>
              (!entry.classId || row.classId === entry.classId) &&
              (!entry.sectionId || row.sectionId === entry.sectionId),
          )
        : [],
    [options, entry.classId, entry.sectionId],
  );
  const entrySubjects = useMemo(
    () => (options ? options.subjects.filter((row) => !entry.classId || row.classId === entry.classId) : []),
    [options, entry.classId],
  );

  const selectedExam = options?.exams.find((row) => row._id === entry.examId);
  const entryClasses = useMemo(() => {
    if (!options) return [];
    if (selectedExam?.classId) return options.classes.filter((row) => row._id === selectedExam.classId);
    return options.classes;
  }, [options, selectedExam]);

  useEffect(() => {
    if (!selectedExam?.classId || entry.classId) return;
    setEntry((current) => ({ ...current, classId: selectedExam.classId ?? "" }));
  }, [selectedExam, entry.classId]);

  const studentTotals = useMemo(() => {
    if (!studentEntry) return { total: 0, gained: 0, percentage: 0 };
    const total = studentEntry.rows.reduce((sum, row) => sum + Number(row.maxMarks || 0), 0);
    const gained = studentEntry.rows.reduce((sum, row) => sum + (row.marksObtained === "" ? 0 : Number(row.marksObtained)), 0);
    return { total, gained, percentage: total > 0 ? (gained / total) * 100 : 0 };
  }, [studentEntry]);

  async function applyFilters() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(key, value);
      }
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const list = await api<{ items: Summary[] }>(`/api/marks/summaries${suffix}`);
      setItems(list.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to filter marks.");
    } finally {
      setLoading(false);
    }
  }

  async function openView(examId: string, studentId?: string) {
    setViewOpen(true);
    setViewLoading(true);
    setViewError("");
    setView(null);
    try {
      const suffix = studentId ? `?examId=${examId}&studentId=${studentId}` : `?examId=${examId}`;
      const data = await api<{ item: ResultView }>(`/api/marks/result${suffix}`);
      setView(data.item);
    } catch (err) {
      setViewError(err instanceof Error ? err.message : "Could not load result.");
    } finally {
      setViewLoading(false);
    }
  }

  async function loadStudentEntry() {
    setEntryError("");
    if (!entry.examId || !entry.classId || !entry.sectionId || !entry.studentId) {
      setEntryError("Select exam, class, section and student.");
      return;
    }
    const params = new URLSearchParams(entry);
    const data = await api<{ item: StudentEntry }>(`/api/marks/entry?${params.toString()}`);
    setStudentEntry(data.item);
    setClassEntry(null);
  }

  async function loadClassEntry() {
    setEntryError("");
    if (!entry.examId || !entry.classId || !entry.sectionId || !entry.subjectId) {
      setEntryError("Select exam, class, section and subject.");
      return;
    }
    const params = new URLSearchParams({
      examId: entry.examId,
      classId: entry.classId,
      sectionId: entry.sectionId,
      subjectId: entry.subjectId,
    });
    const data = await api<{ item: ClassEntry }>(`/api/marks/entry?${params.toString()}`);
    setClassEntry(data.item);
    setStudentEntry(null);
  }

  async function saveStudent() {
    if (!studentEntry) return;
    setSaving(true);
    setEntryError("");
    try {
      const rows = studentEntry.rows
        .filter((row) => row.marksObtained !== "")
        .map((row) => ({
          subjectId: row.subjectId,
          maxMarks: Number(row.maxMarks),
          marksObtained: Number(row.marksObtained),
        }));
      if (!rows.length) throw new Error("Enter gained marks for at least one subject.");
      for (const row of rows) {
        if (row.marksObtained < 0 || row.maxMarks <= 0 || row.marksObtained > row.maxMarks) {
          throw new Error("Gained marks must be between 0 and the subject total.");
        }
      }
      const data = await api<{ message: string }>("/api/marks/save-student", {
        method: "POST",
        body: JSON.stringify({ ...entry, rows }),
      });
      setMessage(data.message);
      setEntryOpen(false);
      await load();
    } catch (err) {
      setEntryError(err instanceof Error ? err.message : "Could not save marks.");
    } finally {
      setSaving(false);
    }
  }

  async function saveClass() {
    if (!classEntry) return;
    setSaving(true);
    setEntryError("");
    try {
      const rows = classEntry.rows
        .filter((row) => row.marksObtained !== "")
        .map((row) => ({ studentId: row.studentId, marksObtained: Number(row.marksObtained) }));
      if (!rows.length) throw new Error("Enter gained marks for at least one student.");
      for (const row of rows) {
        if (row.marksObtained < 0 || row.marksObtained > Number(classEntry.maxMarks)) {
          throw new Error("Gained marks must be between 0 and the subject total.");
        }
      }
      const data = await api<{ message: string }>("/api/marks/save-class-subject", {
        method: "POST",
        body: JSON.stringify({
          examId: entry.examId,
          classId: entry.classId,
          sectionId: entry.sectionId,
          subjectId: entry.subjectId,
          maxMarks: Number(classEntry.maxMarks),
          rows,
        }),
      });
      setMessage(data.message);
      setEntryOpen(false);
      await load();
    } catch (err) {
      setEntryError(err instanceof Error ? err.message : "Could not save marks.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold gs-heading">Marks</h1>
          <p className="text-sm gs-muted">
            {isParent
              ? "View exam-wise results for the linked student."
              : "Enter and review exam-wise, subject-wise marks using student and exam names."}
          </p>
        </div>
        {ctx?.canCreate ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="gs-btn px-4 py-2"
              onClick={() => {
                setEntry({ examId: "", classId: "", sectionId: "", studentId: "", subjectId: "" });
                setStudentEntry(null);
                setClassEntry(null);
                setEntryMode("student");
                setEntryError("");
                setEntryOpen(true);
              }}
            >
              + Create Marks
            </button>
            <button type="button" className="rounded-lg border px-4 py-2 text-sm gs-tab" onClick={() => setBulkOpen(true)}>
              Bulk Upload
            </button>
          </div>
        ) : null}
      </div>

      {isParent ? (
        <div className="rounded-lg border gs-border bg-slate-50 px-4 py-3 text-sm">
          Student: <strong>{parentMeta.studentName}</strong> · Class <strong>{parentMeta.className}</strong> · Section{" "}
          <strong>{parentMeta.sectionName}</strong>
        </div>
      ) : null}

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!isParent && ctx?.canConfigureCriteria ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-sm ${tab === "results" ? "gs-btn" : "gs-tab border"}`}
            onClick={() => setTab("results")}
          >
            Marks
          </button>
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-sm ${tab === "criteria" ? "gs-btn" : "gs-tab border"}`}
            onClick={() => setTab("criteria")}
          >
            Rating Criteria
          </button>
        </div>
      ) : null}

      {tab === "criteria" && ctx?.canConfigureCriteria ? <GradeCriteriaEditor /> : null}

      {tab === "results" && isParent ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold gs-heading">Examination Results</h2>
          {selectedParentExam ? (
            <div className="gs-card space-y-4 p-4">
              <button
                type="button"
                className="text-sm text-[#4c7eff] hover:underline"
                onClick={() => setSelectedParentExam(null)}
              >
                Back to exams
              </button>
              <h3 className="text-base font-semibold gs-heading">{selectedParentExam.examName}</h3>
              <div className="grid gap-2 text-sm md:grid-cols-2">
                <p><span className="gs-muted">Student: </span>{parentMeta.studentName}</p>
                <p><span className="gs-muted">Class: </span>{parentMeta.className}</p>
                <p><span className="gs-muted">Section: </span>{parentMeta.sectionName}</p>
              </div>
              {selectedParentExam.hasMarks ? (
                <div className="rounded-lg border gs-border bg-slate-50 p-3 text-sm">
                  <p>Total Marks: <strong>{selectedParentExam.totalMarks}</strong></p>
                  <p>Gained Marks: <strong>{selectedParentExam.gainedMarks}</strong></p>
                  <p>Percentage: <strong>{pct(selectedParentExam.percentage)}</strong></p>
                  <p>Rating: <strong>{selectedParentExam.rating || "—"}</strong></p>
                </div>
              ) : (
                <p className="text-sm gs-muted">Marks have not been published yet.</p>
              )}
              {selectedParentExam.hasMarks ? (
                <button
                  type="button"
                  className="gs-btn px-4 py-2 text-sm"
                  onClick={() => void openView(selectedParentExam.examId)}
                >
                  View Subject-wise Marks
                </button>
              ) : null}
            </div>
          ) : (
            <div className="gs-card divide-y">
              {loading ? <p className="p-4 text-sm gs-muted">Loading exams…</p> : null}
              {!loading && !parentExams.length ? <p className="p-4 text-sm gs-muted">No exams found.</p> : null}
              {parentExams.map((exam) => (
                <button
                  key={exam.examId}
                  type="button"
                  className="flex w-full flex-col items-start gap-1 p-4 text-left hover:bg-slate-50"
                  onClick={() => setSelectedParentExam(exam)}
                >
                  <span className="font-medium text-[#4c7eff]">{exam.examName}</span>
                  {exam.hasMarks ? (
                    <span className="text-sm gs-muted">
                      Total {exam.totalMarks} · Gained {exam.gainedMarks} · {pct(exam.percentage)} · {exam.rating}
                    </span>
                  ) : (
                    <span className="text-sm gs-muted">Marks have not been published yet.</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === "results" && !isParent ? (
        <div className="space-y-4">
          <div className="gs-card p-4">
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
              {(
                [
                  ["Exam", "examId", options?.exams],
                  ["Class", "classId", options?.classes],
                  ["Section", "sectionId", sections],
                  ["Student", "studentId", students],
                  ["Subject", "subjectId", subjects],
                ] as Array<[string, keyof typeof filters, Option[] | undefined]>
              ).map(([label, key, rows]) => (
                <label key={key} className="block text-sm">
                  {label}
                  <select
                    className="gs-input mt-1"
                    value={filters[key]}
                    onChange={(e) =>
                      setFilters((current) => ({
                        ...current,
                        [key]: e.target.value,
                        ...(key === "classId" ? { sectionId: "", studentId: "", subjectId: "" } : {}),
                        ...(key === "sectionId" ? { studentId: "" } : {}),
                      }))
                    }
                  >
                    <option value="">All</option>
                    {rows?.map((row) => (
                      <option key={row._id} value={row._id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <button type="button" className="gs-btn px-4 py-2 text-sm" onClick={() => void applyFilters()}>
                Apply Filters
              </button>
            </div>
          </div>
          <div className="gs-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="p-3 font-medium">Exam</th>
                  <th className="p-3 font-medium">Student</th>
                  <th className="p-3 font-medium">Class</th>
                  <th className="p-3 font-medium">Section</th>
                  <th className="p-3 font-medium">Total Marks</th>
                  <th className="p-3 font-medium">Gained Marks</th>
                  <th className="p-3 font-medium">Percentage</th>
                  <th className="p-3 font-medium">Rating</th>
                  <th className="p-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="p-4 text-slate-500">Loading marks…</td></tr>
                ) : items.length ? (
                  items.map((item) => (
                    <tr key={`${item.examId}-${item.studentId}`} className="border-t border-slate-100">
                      <td className="p-3">{item.examName}</td>
                      <td className="p-3">{item.studentName}</td>
                      <td className="p-3">{item.className}</td>
                      <td className="p-3">{item.sectionName}</td>
                      <td className="p-3">{item.totalMarks}</td>
                      <td className="p-3">{item.gainedMarks}</td>
                      <td className="p-3">{pct(item.percentage)}</td>
                      <td className="p-3">{item.rating || "—"}</td>
                      <td className="p-3">
                        <button
                          type="button"
                          className="text-[#4c7eff] hover:underline"
                          onClick={() => void openView(item.examId, item.studentId)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={9} className="p-4 text-slate-500">No marks recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {bulkOpen && options ? (
        <BulkMarksUpload
          exams={options.exams}
          classes={options.classes}
          sections={options.sections}
          onClose={() => setBulkOpen(false)}
          onImported={load}
        />
      ) : null}

      {entryOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="gs-card max-h-[90vh] w-full max-w-4xl overflow-y-auto p-6">
            <h2 className="mb-4 text-lg font-semibold gs-heading">Create Marks</h2>
            <div className="mb-4 flex gap-2">
              <button
                type="button"
                className={`rounded-lg px-3 py-1.5 text-sm ${entryMode === "student" ? "gs-btn" : "gs-tab border"}`}
                onClick={() => setEntryMode("student")}
              >
                Student-wise
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-1.5 text-sm ${entryMode === "class" ? "gs-btn" : "gs-tab border"}`}
                onClick={() => setEntryMode("class")}
              >
                Class-wise Subject
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm">
                Exam Name
                <select
                  className="gs-input mt-1"
                  value={entry.examId}
                  onChange={(e) => {
                    const exam = options?.exams.find((row) => row._id === e.target.value);
                    setEntry((c) => ({
                      ...c,
                      examId: e.target.value,
                      classId: exam?.classId || "",
                      sectionId: "",
                      studentId: "",
                      subjectId: "",
                    }));
                    setStudentEntry(null);
                    setClassEntry(null);
                  }}
                >
                  <option value="">Select Exam</option>
                  {options?.exams.map((row) => (
                    <option key={row._id} value={row._id}>{row.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Class Name
                <select className="gs-input mt-1" value={entry.classId} onChange={(e) => setEntry((c) => ({ ...c, classId: e.target.value, sectionId: "", studentId: "", subjectId: "" }))}>
                  <option value="">Select Class</option>
                  {entryClasses.map((row) => (
                    <option key={row._id} value={row._id}>{row.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Section
                <select className="gs-input mt-1" value={entry.sectionId} onChange={(e) => setEntry((c) => ({ ...c, sectionId: e.target.value, studentId: "" }))}>
                  <option value="">Select Section</option>
                  {entrySections.map((row) => (
                    <option key={row._id} value={row._id}>{row.name}</option>
                  ))}
                </select>
              </label>
              {entryMode === "student" ? (
                <label className="block text-sm">
                  Student
                  <select className="gs-input mt-1" value={entry.studentId} onChange={(e) => setEntry((c) => ({ ...c, studentId: e.target.value }))}>
                    <option value="">Select Student</option>
                    {entryStudents.map((row) => (
                      <option key={row._id} value={row._id}>{row.name}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="block text-sm">
                  Subject
                  <select className="gs-input mt-1" value={entry.subjectId} onChange={(e) => setEntry((c) => ({ ...c, subjectId: e.target.value }))}>
                    <option value="">Select Subject</option>
                    {entrySubjects.map((row) => (
                      <option key={row._id} value={row._id}>{row.name}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="mt-4">
              <button
                type="button"
                className="gs-btn px-4 py-2 text-sm"
                onClick={() => void (entryMode === "student" ? loadStudentEntry() : loadClassEntry())}
              >
                Load Marks Sheet
              </button>
            </div>

            {studentEntry ? (
              <div className="mt-5 space-y-3">
                <p className="text-sm">
                  {studentEntry.studentName} · {studentEntry.className} {studentEntry.sectionName} · {studentEntry.examName}
                </p>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left">
                    <tr>
                      <th className="p-3 font-medium">Subject</th>
                      <th className="p-3 font-medium">Total Marks</th>
                      <th className="p-3 font-medium">Gained Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentEntry.rows.map((row, index) => (
                      <tr key={row.subjectId} className="border-t border-slate-100">
                        <td className="p-3">{row.subjectName}</td>
                        <td className="p-3">
                          <input
                            type="number"
                            className="gs-input"
                            min={1}
                            value={row.maxMarks}
                            onChange={(e) =>
                              setStudentEntry((current) =>
                                current
                                  ? {
                                      ...current,
                                      rows: current.rows.map((item, i) =>
                                        i === index ? { ...item, maxMarks: Number(e.target.value) } : item,
                                      ),
                                    }
                                  : current,
                              )
                            }
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            className="gs-input"
                            min={0}
                            value={row.marksObtained}
                            onChange={(e) =>
                              setStudentEntry((current) =>
                                current
                                  ? {
                                      ...current,
                                      rows: current.rows.map((item, i) =>
                                        i === index
                                          ? { ...item, marksObtained: e.target.value === "" ? "" : Number(e.target.value) }
                                          : item,
                                      ),
                                    }
                                  : current,
                              )
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-sm">
                  Total Marks: <strong>{studentTotals.total}</strong> · Gained Marks: <strong>{studentTotals.gained}</strong> ·
                  Percentage: <strong>{pct(studentTotals.percentage)}</strong>
                  {ratingFor(studentTotals.percentage, ctx?.gradeCriteria) ? (
                    <> · Rating: <strong>{ratingFor(studentTotals.percentage, ctx?.gradeCriteria)}</strong></>
                  ) : null}
                </p>
              </div>
            ) : null}

            {classEntry ? (
              <div className="mt-5 space-y-3">
                <p className="text-sm">
                  {classEntry.subjectName} · {classEntry.className} {classEntry.sectionName} · {classEntry.examName}
                </p>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left">
                    <tr>
                      <th className="p-3 font-medium">Student</th>
                      <th className="p-3 font-medium">Total Marks</th>
                      <th className="p-3 font-medium">Gained Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classEntry.rows.map((row, index) => (
                      <tr key={row.studentId} className="border-t border-slate-100">
                        <td className="p-3">{row.studentName}</td>
                        <td className="p-3">{classEntry.maxMarks}</td>
                        <td className="p-3">
                          <input
                            type="number"
                            className="gs-input"
                            min={0}
                            value={row.marksObtained}
                            onChange={(e) =>
                              setClassEntry((current) =>
                                current
                                  ? {
                                      ...current,
                                      rows: current.rows.map((item, i) =>
                                        i === index
                                          ? { ...item, marksObtained: e.target.value === "" ? "" : Number(e.target.value) }
                                          : item,
                                      ),
                                    }
                                  : current,
                              )
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {entryError ? <p className="mt-3 text-sm text-red-600">{entryError}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-lg border px-4 py-2 text-sm gs-tab" onClick={() => setEntryOpen(false)}>
                Cancel
              </button>
              {studentEntry || classEntry ? (
                <button
                  type="button"
                  className="gs-btn px-4 py-2 text-sm"
                  disabled={saving}
                  onClick={() => void (studentEntry ? saveStudent() : saveClass())}
                >
                  {saving ? "Saving…" : "Save Marks"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {viewOpen ? (
        <ResultModal
          item={view}
          loading={viewLoading}
          error={viewError}
          onClose={() => {
            setViewOpen(false);
            setView(null);
          }}
        />
      ) : null}
    </div>
  );
}
