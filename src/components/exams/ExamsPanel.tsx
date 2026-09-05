"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";

type ExamRow = {
  _id: string;
  name?: string;
  className?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  scheduleCount?: number;
};

type ClassOption = { _id: string; name: string; sectionCount: number };
type SubjectOption = { _id: string; name: string; classId: string };
type StatusOption = { value: string; label: string };
type FilterOption = { _id: string; name: string; classId?: string; isCurrent?: boolean };

type ScheduleRow = {
  key: string;
  _id?: string;
  subjectId: string;
  date: string;
  startTime: string;
};

type ScheduleItem = {
  _id: string;
  examId: string;
  examName: string;
  className: string;
  sectionNames: string;
  subjectName: string;
  date: string;
  dayName: string;
  timeLabel: string;
  status: string;
};

type ModuleContext = {
  mode: "admin" | "teacher" | "parent" | "student";
  canCreate: boolean;
  canEdit: boolean;
  studentContext?: {
    studentName: string;
    className: string;
    sectionName: string;
  };
  teacherContext?: {
    className: string;
    sectionName: string;
    subjectName?: string;
  };
};

type FilterOptions = {
  academicSessions: FilterOption[];
  exams: Array<{ _id: string; name: string; classId: string }>;
  classes: FilterOption[];
  sections: FilterOption[];
  subjects: FilterOption[];
};

function newScheduleRow(): ScheduleRow {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    subjectId: "",
    date: "",
    startTime: "",
  };
}

function formatStatus(status?: string) {
  const map: Record<string, string> = {
    DRAFT: "Draft",
    SCHEDULED: "Scheduled",
    ACTIVE: "Active",
    ONGOING: "Active",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  };
  return status ? map[status] ?? status : "—";
}

function buildScheduleQuery(filters: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function ExamsPanel() {
  const [tab, setTab] = useState<"exams" | "schedule">("schedule");
  const [moduleContext, setModuleContext] = useState<ModuleContext | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [items, setItems] = useState<ExamRow[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [name, setName] = useState("");
  const [classId, setClassId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);

  const [filters, setFilters] = useState({
    academicSessionId: "",
    examId: "",
    classId: "",
    sectionId: "",
    subjectId: "",
    dateFrom: "",
    dateTo: "",
  });

  const loadSchedules = useCallback(async (nextFilters = filters) => {
    const data = await api<{ items: ScheduleItem[] }>(
      `/api/exams/schedules${buildScheduleQuery(nextFilters)}`,
    );
    setScheduleItems(data.items);
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [listRes, optionsRes, contextRes] = await Promise.all([
        api<{ items: ExamRow[] }>("/api/exams"),
        api<{ classes: ClassOption[]; subjects: SubjectOption[]; statuses: StatusOption[] }>(
          "/api/exams/form-options",
        ),
        api<{ moduleContext: ModuleContext; filterOptions: FilterOptions }>("/api/exams/module-context"),
      ]);
      setItems(listRes.items);
      setClasses(optionsRes.classes);
      setSubjects(optionsRes.subjects);
      setStatuses(optionsRes.statuses);
      setModuleContext(contextRes.moduleContext);
      setFilterOptions(contextRes.filterOptions);
      await loadSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load exams.");
    } finally {
      setLoading(false);
    }
  }, [loadSchedules]);

  useEffect(() => {
    void load();
  }, [load]);

  const classSubjects = useMemo(
    () => subjects.filter((row) => row.classId === classId),
    [classId, subjects],
  );

  const selectedClass = useMemo(() => classes.find((row) => row._id === classId), [classId, classes]);

  const filteredSections = useMemo(() => {
    if (!filterOptions) return [];
    if (!filters.classId) return filterOptions.sections;
    return filterOptions.sections.filter((row) => row.classId === filters.classId);
  }, [filterOptions, filters.classId]);

  const filteredSubjects = useMemo(() => {
    if (!filterOptions) return [];
    if (!filters.classId) return filterOptions.subjects;
    return filterOptions.subjects.filter((row) => row.classId === filters.classId);
  }, [filterOptions, filters.classId]);

  function resetForm() {
    setName("");
    setClassId("");
    setStartDate("");
    setEndDate("");
    setStatus("DRAFT");
    setSchedules([]);
    setFormError("");
    setEditingId(null);
  }

  function openCreate() {
    resetForm();
    setDialogMode("create");
    setDialogOpen(true);
  }

  async function openEdit(id: string) {
    setDialogMode("edit");
    setEditingId(id);
    setFormError("");
    try {
      const data = await api<{
        item: {
          name: string;
          classId: string;
          startDate: string;
          endDate: string;
          status: string;
          schedules: Array<{ _id: string; subjectId: string; date: string; startTime: string }>;
        };
      }>(`/api/exams/${id}/edit`);
      setName(data.item.name);
      setClassId(data.item.classId);
      setStartDate(data.item.startDate);
      setEndDate(data.item.endDate);
      setStatus(data.item.status);
      setSchedules(
        data.item.schedules.map((row) => ({
          key: row._id,
          _id: row._id,
          subjectId: row.subjectId,
          date: row.date,
          startTime: row.startTime,
        })),
      );
      setDialogOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open exam for editing.");
    }
  }

  function addScheduleRow() {
    if (!classId) {
      setFormError("Please select a class before adding a schedule.");
      return;
    }
    if (!classSubjects.length) {
      setFormError("No subjects are configured for the selected class.");
      return;
    }
    setFormError("");
    setSchedules((rows) => [...rows, newScheduleRow()]);
  }

  function updateScheduleRow(key: string, patch: Partial<ScheduleRow>) {
    setSchedules((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeScheduleRow(key: string) {
    setSchedules((rows) => rows.filter((row) => row.key !== key));
  }

  async function saveExam() {
    setSaving(true);
    setFormError("");
    try {
      if (!name.trim()) throw new Error("Exam name is required.");
      if (!classId) throw new Error("Class name is required.");
      if (!startDate) throw new Error("Start date is required.");
      if (!endDate) throw new Error("End date is required.");
      if (endDate < startDate) throw new Error("End date cannot be earlier than start date.");
      if (!status) throw new Error("Status is required.");
      if (!schedules.length) throw new Error("Add at least one exam schedule.");

      for (const row of schedules) {
        if (!row.subjectId) throw new Error("Each schedule must have a subject.");
        if (!row.date) throw new Error("Each schedule must have a date.");
        if (!row.startTime) throw new Error("Each schedule must have a time.");
        if (row.date < startDate || row.date > endDate) {
          throw new Error("Schedule dates must fall within the exam start and end dates.");
        }
      }

      const duplicate = new Set<string>();
      for (const row of schedules) {
        const key = `${row.subjectId}:${row.date}`;
        if (duplicate.has(key)) throw new Error("Duplicate subject and date schedules are not allowed.");
        duplicate.add(key);
      }

      const payload = {
        name: name.trim(),
        classId,
        startDate,
        endDate,
        status,
        schedules: schedules.map((row) => ({
          _id: row._id,
          subjectId: row.subjectId,
          date: row.date,
          startTime: row.startTime,
        })),
      };

      if (dialogMode === "create") {
        const data = await api<{ message: string }>("/api/exams/create", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMessage(data.message);
      } else if (editingId) {
        const data = await api<{ message: string }>(`/api/exams/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setMessage(data.message);
      }

      setDialogOpen(false);
      resetForm();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save exam.");
    } finally {
      setSaving(false);
    }
  }

  async function applyFilters() {
    setLoading(true);
    setError("");
    try {
      await loadSchedules(filters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load exam schedules.");
    } finally {
      setLoading(false);
    }
  }

  const canCreate = moduleContext?.canCreate ?? false;
  const canEdit = moduleContext?.canEdit ?? false;
  const readOnly = moduleContext?.mode === "parent" || moduleContext?.mode === "student";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold gs-heading">Examinations</h1>
          <p className="text-sm gs-muted">
            {readOnly
              ? "View exam schedules for the linked student."
              : "Create exams and subject-wise schedules for all sections in a class."}
          </p>
        </div>
        {canCreate ? (
          <button type="button" className="gs-btn px-4 py-2" onClick={openCreate}>
            Create Exam
          </button>
        ) : null}
      </div>

      {moduleContext?.studentContext ? (
        <div className="rounded-lg border gs-border bg-slate-50 px-4 py-3 text-sm">
          Student: <strong>{moduleContext.studentContext.studentName}</strong> · Class{" "}
          <strong>{moduleContext.studentContext.className}</strong> · Section{" "}
          <strong>{moduleContext.studentContext.sectionName}</strong>
        </div>
      ) : null}

      {moduleContext?.teacherContext ? (
        <div className="rounded-lg border gs-border bg-slate-50 px-4 py-3 text-sm">
          Today&apos;s Class: <strong>{moduleContext.teacherContext.className}</strong> · Section{" "}
          <strong>{moduleContext.teacherContext.sectionName}</strong>
          {moduleContext.teacherContext.subjectName ? (
            <>
              {" "}
              · Subject <strong>{moduleContext.teacherContext.subjectName}</strong>
            </>
          ) : null}
        </div>
      ) : null}

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-lg px-4 py-2 text-sm ${tab === "schedule" ? "gs-btn" : "gs-tab border"}`}
          onClick={() => setTab("schedule")}
        >
          Exam Schedule
        </button>
        <button
          type="button"
          className={`rounded-lg px-4 py-2 text-sm ${tab === "exams" ? "gs-btn" : "gs-tab border"}`}
          onClick={() => setTab("exams")}
        >
          Exams
        </button>
      </div>

      {tab === "schedule" ? (
        <div className="space-y-4">
          <div className="gs-card p-4">
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <label className="block text-sm">
                Academic Session
                <select
                  className="gs-input mt-1"
                  value={filters.academicSessionId}
                  onChange={(e) => setFilters((current) => ({ ...current, academicSessionId: e.target.value }))}
                >
                  <option value="">All Sessions</option>
                  {filterOptions?.academicSessions.map((row) => (
                    <option key={row._id} value={row._id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Exam
                <select
                  className="gs-input mt-1"
                  value={filters.examId}
                  onChange={(e) => setFilters((current) => ({ ...current, examId: e.target.value }))}
                >
                  <option value="">All Exams</option>
                  {filterOptions?.exams.map((row) => (
                    <option key={row._id} value={row._id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Class
                <select
                  className="gs-input mt-1"
                  value={filters.classId}
                  onChange={(e) =>
                    setFilters((current) => ({ ...current, classId: e.target.value, sectionId: "", subjectId: "" }))
                  }
                >
                  <option value="">All Classes</option>
                  {filterOptions?.classes.map((row) => (
                    <option key={row._id} value={row._id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Section
                <select
                  className="gs-input mt-1"
                  value={filters.sectionId}
                  onChange={(e) => setFilters((current) => ({ ...current, sectionId: e.target.value }))}
                >
                  <option value="">All Sections</option>
                  {filteredSections.map((row) => (
                    <option key={row._id} value={row._id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Subject
                <select
                  className="gs-input mt-1"
                  value={filters.subjectId}
                  onChange={(e) => setFilters((current) => ({ ...current, subjectId: e.target.value }))}
                >
                  <option value="">All Subjects</option>
                  {filteredSubjects.map((row) => (
                    <option key={row._id} value={row._id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Date From
                <input
                  type="date"
                  className="gs-input mt-1"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters((current) => ({ ...current, dateFrom: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                Date To
                <input
                  type="date"
                  className="gs-input mt-1"
                  value={filters.dateTo}
                  onChange={(e) => setFilters((current) => ({ ...current, dateTo: e.target.value }))}
                />
              </label>
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
                  <th className="p-3 font-medium">Date</th>
                  <th className="p-3 font-medium">Day</th>
                  <th className="p-3 font-medium">Time</th>
                  <th className="p-3 font-medium">Subject</th>
                  <th className="p-3 font-medium">Class</th>
                  <th className="p-3 font-medium">Section</th>
                  <th className="p-3 font-medium">Exam</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-slate-500">
                      Loading exam schedules…
                    </td>
                  </tr>
                ) : scheduleItems.length ? (
                  scheduleItems.map((item) => (
                    <tr key={item._id} className="border-t border-slate-100">
                      <td className="p-3">{item.date}</td>
                      <td className="p-3">{item.dayName}</td>
                      <td className="p-3">{item.timeLabel}</td>
                      <td className="p-3">{item.subjectName}</td>
                      <td className="p-3">{item.className}</td>
                      <td className="p-3">{item.sectionNames}</td>
                      <td className="p-3">{item.examName}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-4 text-slate-500">
                      No exam schedules found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="gs-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-3 font-medium">Exam</th>
                <th className="p-3 font-medium">Class</th>
                <th className="p-3 font-medium">Start</th>
                <th className="p-3 font-medium">End</th>
                <th className="p-3 font-medium">Status</th>
                {canEdit ? <th className="p-3 font-medium">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="p-4 text-slate-500">
                    Loading exams…
                  </td>
                </tr>
              ) : items.length ? (
                items.map((item) => (
                  <tr key={item._id} className="border-t border-slate-100">
                    <td className="p-3">{item.name ?? "—"}</td>
                    <td className="p-3">{item.className ?? "—"}</td>
                    <td className="p-3">{item.startDate ?? "—"}</td>
                    <td className="p-3">{item.endDate ?? "—"}</td>
                    <td className="p-3">{formatStatus(item.status)}</td>
                    {canEdit ? (
                      <td className="p-3">
                        <button
                          type="button"
                          className="text-[#4c7eff] hover:underline"
                          onClick={() => void openEdit(item._id)}
                        >
                          Edit
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="p-4 text-slate-500">
                    No exams created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="gs-card max-h-[90vh] w-full max-w-3xl overflow-y-auto p-6">
            <h2 className="text-lg font-semibold gs-heading mb-4">
              {dialogMode === "create" ? "Create Exam" : "Edit Exam"}
            </h2>

            <div className="space-y-4">
              <label className="block text-sm">
                Exam Name
                <input className="gs-input mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
              </label>

              <label className="block text-sm">
                Class Name
                <select
                  className="gs-input mt-1"
                  value={classId}
                  onChange={(e) => {
                    setClassId(e.target.value);
                    if (dialogMode === "create") setSchedules([]);
                  }}
                  required
                >
                  <option value="">Select Class</option>
                  {classes.map((row) => (
                    <option key={row._id} value={row._id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>

              {selectedClass ? (
                <p className="text-xs gs-muted">
                  Applies to all {selectedClass.sectionCount} section(s) under {selectedClass.name}.
                </p>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm">
                  Start Date
                  <input
                    type="date"
                    className="gs-input mt-1"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </label>
                <label className="block text-sm">
                  End Date
                  <input
                    type="date"
                    className="gs-input mt-1"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </label>
              </div>

              <label className="block text-sm">
                Status
                <select className="gs-input mt-1" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {statuses.map((row) => (
                    <option key={row.value} value={row.value}>
                      {row.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold gs-heading">Exam Schedule</h3>

                {!classId ? (
                  <p className="text-sm gs-muted">Select a class to add schedule rows.</p>
                ) : !classSubjects.length ? (
                  <p className="text-sm text-amber-700">No subjects are configured for the selected class.</p>
                ) : schedules.length ? (
                  <div className="overflow-x-auto rounded-lg border gs-border">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-left">
                        <tr>
                          <th className="p-3 font-medium">Subject Name</th>
                          <th className="p-3 font-medium">Date</th>
                          <th className="p-3 font-medium">Time</th>
                          <th className="p-3 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schedules.map((row) => (
                          <tr key={row.key} className="border-t border-slate-100">
                            <td className="p-3">
                              <select
                                className="gs-input"
                                value={row.subjectId}
                                onChange={(e) => updateScheduleRow(row.key, { subjectId: e.target.value })}
                              >
                                <option value="">Select Subject</option>
                                {classSubjects.map((subject) => (
                                  <option key={subject._id} value={subject._id}>
                                    {subject.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-3">
                              <input
                                type="date"
                                className="gs-input"
                                value={row.date}
                                min={startDate || undefined}
                                max={endDate || undefined}
                                onChange={(e) => updateScheduleRow(row.key, { date: e.target.value })}
                              />
                            </td>
                            <td className="p-3">
                              <input
                                type="time"
                                className="gs-input"
                                value={row.startTime}
                                onChange={(e) => updateScheduleRow(row.key, { startTime: e.target.value })}
                              />
                            </td>
                            <td className="p-3">
                              <button
                                type="button"
                                className="text-sm text-red-600 hover:underline"
                                onClick={() => removeScheduleRow(row.key)}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm gs-muted">Click Create Schedule to add subject-wise exam timings.</p>
                )}

                <button
                  type="button"
                  className="rounded-lg border px-3 py-1.5 text-sm gs-tab"
                  onClick={addScheduleRow}
                  disabled={!classId || !classSubjects.length}
                >
                  Create Schedule
                </button>
              </div>

              {formError ? <p className="text-sm text-red-600">{formError}</p> : null}

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-lg border px-4 py-2 text-sm gs-tab"
                  disabled={saving}
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="gs-btn px-4 py-2 text-sm"
                  disabled={saving}
                  onClick={() => void saveExam()}
                >
                  {saving ? "Saving…" : dialogMode === "create" ? "Create" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
