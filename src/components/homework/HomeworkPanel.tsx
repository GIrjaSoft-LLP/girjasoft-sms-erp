"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ParentHomeworkWeek, shiftWeek } from "@/components/homework/ParentHomeworkWeek";
import { api } from "@/lib/client";
import { startOfWeekMonday, weekEndFromStart } from "@/lib/homework/week-range";

type HomeworkRow = {
  _id: string;
  className?: string;
  sectionName?: string;
  subjectName?: string;
  title?: string;
  dueDate?: string;
  description?: string;
  teacherName?: string;
};

type LookupOption = { _id: string; name: string; classId?: string };

type FormContext = {
  mode: "admin" | "teacher" | "parent" | "student";
  ready: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  message?: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  className: string;
  sectionName: string;
  subjectName: string;
  classes: LookupOption[];
  sections: LookupOption[];
  subjects: LookupOption[];
};

type HomeworkFormState = {
  title: string;
  description: string;
  dueDate: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  className: string;
  sectionName: string;
  subjectName: string;
};

type HomeworkView = {
  title: string;
  description: string;
  dueDate: string;
  className: string;
  sectionName: string;
  subjectName: string;
  teacherName?: string;
  createdAt?: string;
};

const emptyForm: HomeworkFormState = {
  title: "",
  description: "",
  dueDate: "",
  classId: "",
  sectionId: "",
  subjectId: "",
  className: "",
  sectionName: "",
  subjectName: "",
};

function formatDisplayDate(value?: string) {
  if (!value) return "—";
  const isoDay = value.slice(0, 10);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(isoDay) ? new Date(`${isoDay}T00:00:00`) : new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function HomeworkForm({
  form,
  setForm,
  readOnlyContext,
  adminLookups,
  onSubmit,
  onCancel,
  busy,
  error,
  submitLabel,
}: {
  form: HomeworkFormState;
  setForm: React.Dispatch<React.SetStateAction<HomeworkFormState>>;
  readOnlyContext: boolean;
  adminLookups: { classes: LookupOption[]; sections: LookupOption[]; subjects: LookupOption[] } | null;
  onSubmit: () => void;
  onCancel: () => void;
  busy: boolean;
  error: string;
  submitLabel: string;
}) {
  const sections = useMemo(
    () => (adminLookups ? adminLookups.sections.filter((row) => row.classId === form.classId) : []),
    [adminLookups, form.classId],
  );
  const subjects = useMemo(
    () => (adminLookups ? adminLookups.subjects.filter((row) => row.classId === form.classId) : []),
    [adminLookups, form.classId],
  );

  return (
    <div className="space-y-4">
      {adminLookups ? (
        <>
          <label className="block text-sm">
            Class Name
            <select
              className="gs-input mt-1"
              value={form.classId}
              required
              onChange={(e) => {
                const selected = adminLookups.classes.find((row) => row._id === e.target.value);
                setForm((current) => ({
                  ...current,
                  classId: e.target.value,
                  className: selected?.name ?? "",
                  sectionId: "",
                  sectionName: "",
                  subjectId: "",
                  subjectName: "",
                }));
              }}
            >
              <option value="">Select Class</option>
              {adminLookups.classes.map((row) => (
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
              value={form.sectionId}
              required
              disabled={!form.classId}
              onChange={(e) => {
                const selected = sections.find((row) => row._id === e.target.value);
                setForm((current) => ({
                  ...current,
                  sectionId: e.target.value,
                  sectionName: selected?.name ?? "",
                }));
              }}
            >
              <option value="">Select Section</option>
              {sections.map((row) => (
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
              value={form.subjectId}
              required
              disabled={!form.classId}
              onChange={(e) => {
                const selected = subjects.find((row) => row._id === e.target.value);
                setForm((current) => ({
                  ...current,
                  subjectId: e.target.value,
                  subjectName: selected?.name ?? "",
                }));
              }}
            >
              <option value="">Select Subject</option>
              {subjects.map((row) => (
                <option key={row._id} value={row._id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <>
          <label className="block text-sm">
            Class Name
            <input className="gs-input mt-1" value={form.className} readOnly={readOnlyContext} disabled={readOnlyContext} />
          </label>
          <label className="block text-sm">
            Section
            <input className="gs-input mt-1" value={form.sectionName} readOnly={readOnlyContext} disabled={readOnlyContext} />
          </label>
          <label className="block text-sm">
            Subject
            <input className="gs-input mt-1" value={form.subjectName} readOnly={readOnlyContext} disabled={readOnlyContext} />
          </label>
        </>
      )}
      <label className="block text-sm">
        Due Date
        <input
          type="date"
          className="gs-input mt-1"
          value={form.dueDate}
          required
          onChange={(e) => setForm((current) => ({ ...current, dueDate: e.target.value }))}
        />
      </label>
      <label className="block text-sm">
        Title
        <input
          className="gs-input mt-1"
          value={form.title}
          required
          onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
        />
      </label>
      <label className="block text-sm">
        Description
        <textarea
          className="gs-input mt-1 min-h-[120px]"
          value={form.description}
          onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" className="gs-btn px-4 py-2 text-sm" disabled={busy} onClick={onSubmit}>
          {busy ? "Saving…" : submitLabel}
        </button>
        <button type="button" className="rounded-lg border px-4 py-2 text-sm gs-tab" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function HomeworkViewModal({
  item,
  loading,
  error,
  onClose,
}: {
  item: HomeworkView | null;
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose} role="presentation">
      <div
        className="gs-card flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden p-6"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="homework-view-title"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="homework-view-title" className="text-lg font-semibold gs-heading">
            Homework Details
          </h2>
          <button type="button" className="rounded-lg border px-3 py-1.5 text-sm gs-tab" onClick={onClose}>
            Cancel
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1 text-sm">
          {loading ? <p className="gs-muted">Loading homework…</p> : null}
          {error ? <p className="text-red-600">{error}</p> : null}
          {!loading && !error && item ? (
            <div className="space-y-3">
              <p>
                <span className="gs-muted">Class Name: </span>
                {item.className || "—"}
              </p>
              <p>
                <span className="gs-muted">Section: </span>
                {item.sectionName || "—"}
              </p>
              <p>
                <span className="gs-muted">Subject: </span>
                {item.subjectName || "—"}
              </p>
              <p>
                <span className="gs-muted">Due Date: </span>
                {formatDisplayDate(item.dueDate)}
              </p>
              {item.teacherName ? (
                <p>
                  <span className="gs-muted">Created By: </span>
                  {item.teacherName}
                </p>
              ) : null}
              {item.createdAt ? (
                <p>
                  <span className="gs-muted">Created Date: </span>
                  {formatDisplayDate(item.createdAt)}
                </p>
              ) : null}
              <div>
                <p className="gs-muted">Title</p>
                <p className="font-medium">{item.title || "—"}</p>
              </div>
              <div>
                <p className="gs-muted">Description</p>
                <p className="whitespace-pre-wrap break-words leading-6">
                  {item.description?.trim() ? item.description : "No description was provided."}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function HomeworkPanel() {
  const [formContext, setFormContext] = useState<FormContext | null>(null);
  const [items, setItems] = useState<HomeworkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<HomeworkFormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<HomeworkView | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState("");
  const [weekStart, setWeekStart] = useState(startOfWeekMonday);

  const isTeacherMode = formContext?.mode === "teacher";
  const isAdminMode = formContext?.mode === "admin";
  const isReadOnlyRole = formContext?.mode === "parent" || formContext?.mode === "student";

  const loadItems = useCallback(async (mode?: FormContext["mode"]) => {
    const readOnly = mode === "parent" || mode === "student";
    setLoading(true);
    setError("");
    try {
      const listUrl = readOnly
        ? `/api/homework?startDate=${weekStart}&endDate=${weekEndFromStart(weekStart)}`
        : "/api/homework";
      const listRes = await api<{ items: HomeworkRow[] }>(listUrl);
      setItems(listRes.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load homework.");
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const contextRes = await api<{ formContext: FormContext }>("/api/homework/form-context");
        if (cancelled) return;
        setFormContext(contextRes.formContext);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load homework.");
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!formContext) return;
    void loadItems(formContext.mode);
  }, [formContext, loadItems]);

  const canCreate = Boolean(formContext?.canCreate && (isAdminMode || (isTeacherMode && formContext?.ready)));
  const canEdit = Boolean(formContext?.canEdit);
  const canDelete = Boolean(formContext?.canDelete);

  function openCreate() {
    if (!formContext) return;
    if (isTeacherMode && !formContext.ready) {
      setError(formContext.message ?? "Please select today's class before creating homework.");
      return;
    }
    setDialogMode("create");
    setEditingId(null);
    setFormError("");
    setForm({
      ...emptyForm,
      classId: formContext.classId,
      sectionId: formContext.sectionId,
      subjectId: formContext.subjectId,
      className: formContext.className,
      sectionName: formContext.sectionName,
      subjectName: formContext.subjectName,
      dueDate: new Date().toISOString().slice(0, 10),
    });
    setDialogOpen(true);
  }

  async function openEdit(id: string) {
    setDialogMode("edit");
    setEditingId(id);
    setFormError("");
    try {
      const data = await api<{ item: HomeworkFormState & { _id: string } }>(`/api/homework/${id}/edit`);
      setForm({
        title: data.item.title ?? "",
        description: data.item.description ?? "",
        dueDate: data.item.dueDate ?? "",
        classId: data.item.classId ?? "",
        sectionId: data.item.sectionId ?? "",
        subjectId: data.item.subjectId ?? "",
        className: data.item.className ?? "",
        sectionName: data.item.sectionName ?? "",
        subjectName: data.item.subjectName ?? "",
      });
      setDialogOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load homework.");
    }
  }

  async function openView(id: string) {
    setViewOpen(true);
    setViewLoading(true);
    setViewError("");
    setViewItem(null);
    try {
      const data = await api<{ item: HomeworkView }>(`/api/homework/${id}/view`);
      setViewItem(data.item);
    } catch (err) {
      setViewError(err instanceof Error ? err.message : "Could not load homework.");
    } finally {
      setViewLoading(false);
    }
  }

  async function removeHomework(id: string) {
    try {
      await api(`/api/homework/${id}`, { method: "DELETE" });
      await loadItems(formContext?.mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete homework.");
    }
  }

  async function saveHomework() {
    setSaving(true);
    setFormError("");
    try {
      const payload: Record<string, string> = {
        title: form.title.trim(),
        description: form.description.trim(),
        dueDate: form.dueDate,
      };
      if (!payload.title) throw new Error("Title is required.");
      if (!payload.dueDate) throw new Error("Due date is required.");

      if (dialogMode === "create") {
        if (isAdminMode) {
          if (!form.classId || !form.sectionId || !form.subjectId) {
            throw new Error("Class, section and subject are required.");
          }
          payload.classId = form.classId;
          payload.sectionId = form.sectionId;
          payload.subjectId = form.subjectId;
        }
        await api("/api/homework", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      } else if (editingId) {
        await api(`/api/homework/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      setDialogOpen(false);
      await loadItems(formContext?.mode);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save homework.");
    } finally {
      setSaving(false);
    }
  }

  const subtitle = isReadOnlyRole
    ? "View homework assigned to the linked student."
    : isTeacherMode
      ? "Create and manage homework for your assigned classes."
      : "Create and manage homework for any class in this workspace.";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold gs-heading">Homework</h1>
          <p className="text-sm gs-muted">{subtitle}</p>
        </div>
        {canCreate ? (
          <button type="button" className="gs-btn px-4 py-2" onClick={openCreate}>
            Create Homework
          </button>
        ) : null}
      </div>

      {isTeacherMode && formContext && !formContext.ready ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {formContext.message ?? "Please select today's class before creating homework."}
        </div>
      ) : isTeacherMode && formContext?.ready ? (
        <div className="rounded-lg border gs-border bg-slate-50 px-4 py-3 text-sm">
          Today&apos;s Class: <strong>{formContext.className}</strong> · Section <strong>{formContext.sectionName}</strong>
          {formContext.subjectName ? (
            <>
              {" "}
              · Subject <strong>{formContext.subjectName}</strong>
            </>
          ) : null}
        </div>
      ) : null}

      {error && !isReadOnlyRole ? <p className="text-sm text-red-600">{error}</p> : null}

      {isReadOnlyRole ? (
        <ParentHomeworkWeek
          startDate={weekStart}
          items={items}
          loading={loading}
          error={error}
          onPrev={() => setWeekStart((current) => shiftWeek(current, -1))}
          onNext={() => setWeekStart((current) => shiftWeek(current, 1))}
          onView={(id) => void openView(id)}
        />
      ) : (
      <div className="gs-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-3 font-medium">Class</th>
              <th className="p-3 font-medium">Section</th>
              <th className="p-3 font-medium">Subject</th>
              <th className="p-3 font-medium">Due Date</th>
              <th className="p-3 font-medium">Title</th>
              <th className="p-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-4 text-slate-500">
                  Loading homework…
                </td>
              </tr>
            ) : items.length ? (
              items.map((item) => (
                <tr key={item._id} className="border-t border-slate-100">
                  <td className="p-3">{item.className ?? "—"}</td>
                  <td className="p-3">{item.sectionName ?? "—"}</td>
                  <td className="p-3">{item.subjectName ?? "—"}</td>
                  <td className="p-3">{formatDisplayDate(item.dueDate)}</td>
                  <td className="p-3">{item.title ?? "—"}</td>
                  <td className="p-3 space-x-3">
                    {canEdit ? (
                          <button type="button" className="text-[#4c7eff] hover:underline" onClick={() => void openEdit(item._id)}>
                            Edit
                          </button>
                        ) : null}
                        <button type="button" className="text-[#4c7eff] hover:underline" onClick={() => void openView(item._id)}>
                          View
                        </button>
                        {canDelete ? (
                          <button
                            type="button"
                            className="text-red-600 hover:underline"
                            onClick={() => void removeHomework(item._id)}
                          >
                            Delete
                          </button>
                        ) : null}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="p-4 text-slate-500">
                  No homework created yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="gs-card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
            <h2 className="text-lg font-semibold gs-heading mb-4">
              {dialogMode === "create" ? "Create Homework" : "Edit Homework"}
            </h2>
            <HomeworkForm
              form={form}
              setForm={setForm}
              readOnlyContext={isTeacherMode || dialogMode === "edit"}
              adminLookups={isAdminMode && dialogMode === "create" ? formContext : null}
              onSubmit={() => void saveHomework()}
              onCancel={() => setDialogOpen(false)}
              busy={saving}
              error={formError}
              submitLabel={dialogMode === "create" ? "Create" : "Save Changes"}
            />
          </div>
        </div>
      ) : null}

      {viewOpen ? (
        <HomeworkViewModal
          item={viewItem}
          loading={viewLoading}
          error={viewError}
          onClose={() => {
            setViewOpen(false);
            setViewItem(null);
            setViewError("");
          }}
        />
      ) : null}
    </div>
  );
}
